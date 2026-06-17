import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { db } from '@cp-battle/db';
import { judgeSubmission, getLanguage } from '@cp-battle/judge';
import type { LanguageId } from '@cp-battle/judge';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: { matchId: string } },
) {
  try {
    const user = await requireUser();
    const { matchId } = params;
    const body = await req.json();

    const { problemId, language, code, mode } = body as {
      problemId: string;
      language: LanguageId;
      code: string;
      mode?: 'RUN' | 'SUBMIT';
    };

    if (!problemId || !language || !code) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const langConfig = getLanguage(language);
    if (!langConfig) {
      return NextResponse.json({ error: 'Unsupported language' }, { status: 400 });
    }

    const match = await db.match.findUnique({
      where: { id: matchId },
      include: { progress: true },
    });

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    if (match.playerAId !== user.id && match.playerBId !== user.id) {
      return NextResponse.json({ error: 'Not your match' }, { status: 403 });
    }

    if (match.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'Match is not in progress' }, { status: 409 });
    }

    // Verify the problem is unlocked for this user
    const progress = match.progress.find(
      (p) => p.userId === user.id && p.problemId === problemId,
    );
    if (!progress || progress.status === 'LOCKED') {
      return NextResponse.json({ error: 'Problem is locked' }, { status: 403 });
    }

    const problem = await db.problem.findUnique({
      where: { id: problemId },
      include: { testCases: { orderBy: { order: 'asc' } } },
    });

    if (!problem) {
      return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
    }

    const submissionMode = mode === 'RUN' ? 'RUN' : 'SUBMIT';

    // For RUN: only sample test cases. For SUBMIT: all test cases.
    const testCases =
      submissionMode === 'RUN'
        ? problem.testCases.filter((tc) => tc.isSample)
        : problem.testCases;

    if (testCases.length === 0) {
      return NextResponse.json({ error: 'No test cases available' }, { status: 500 });
    }

    // Create submission record
    const submission = await db.submission.create({
      data: {
        matchId: match.id,
        userId: user.id,
        problemId,
        language,
        code,
        mode: submissionMode,
        verdict: 'RUNNING',
        total: testCases.length,
      },
    });

    // Judge
    const result = await judgeSubmission({
      language: langConfig,
      source: code,
      testCases: testCases.map((tc) => ({ input: tc.input, expected: tc.expectedOutput })),
      timeLimitMs: problem.timeLimitMs,
      memoryLimitMb: problem.memoryLimitMb,
    });

    // Update submission
    await db.submission.update({
      where: { id: submission.id },
      data: {
        verdict: result.verdict,
        passed: result.passed,
        timeMs: result.timeMs,
        memoryKb: result.memoryKb,
        error: result.compileError ?? result.runtimeError ?? null,
      },
    });

    // If SUBMIT and AC in a match, update progress
    if (submissionMode === 'SUBMIT' && result.verdict === 'AC') {
      const difficulty = problem.difficulty;
      const nextDifficulty = difficulty === 'EASY' ? 'MEDIUM' : difficulty === 'MEDIUM' ? 'HARD' : null;

      await db.matchProgress.update({
        where: { id: progress.id },
        data: {
          status: 'SOLVED',
          solvedAt: new Date(),
          scoreEarned:
            problem.points - progress.wrongSubmissions * 10,
        },
      });

      // Unlock next difficulty
      if (nextDifficulty) {
        const nextProgress = match.progress.find(
          (p) => p.userId === user.id && p.difficulty === nextDifficulty,
        );
        if (nextProgress) {
          await db.matchProgress.update({
            where: { id: nextProgress.id },
            data: { status: 'UNLOCKED', unlockedAt: new Date() },
          });
        }
      }
    }

    // If SUBMIT and not AC, increment wrong submissions
    if (submissionMode === 'SUBMIT' && result.verdict !== 'AC') {
      await db.matchProgress.update({
        where: { id: progress.id },
        data: { wrongSubmissions: { increment: 1 } },
      });
    }

    return NextResponse.json({
      submissionId: submission.id,
      verdict: result.verdict,
      passed: result.passed,
      total: result.total,
      timeMs: result.timeMs,
      memoryKb: result.memoryKb,
      error: result.compileError ?? result.runtimeError ?? null,
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
