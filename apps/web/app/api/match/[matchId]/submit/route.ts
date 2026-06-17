import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { db } from '@cp-battle/db';
import { judgeSubmission, getLanguage } from '@cp-battle/judge';
import type { LanguageId } from '@cp-battle/judge';
import { MATCH_CONFIG, type MatchModeType } from '@cp-battle/match';
import { finalizeMatch } from '@cp-battle/match';
import { emitToMatch } from '@/lib/socket';
import type { SubmissionVerdictPayload, OpponentSnapshot, MatchEndPayload } from '@cp-battle/realtime';

export const dynamic = 'force-dynamic';

/** Build an OpponentSnapshot for a player. */
async function buildOpponentSnapshot(matchId: string, userId: string, totalProblems: number): Promise<OpponentSnapshot> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, username: true } });
  const progress = await db.matchProgress.findMany({
    where: { matchId, userId },
    orderBy: { problemOrder: 'asc' },
  });
  const solvedCount = progress.filter((p) => p.status === 'SOLVED').length;
  const score = progress.reduce((sum, p) => sum + p.scoreEarned, 0);

  return {
    userId,
    username: user?.username ?? 'Unknown',
    score,
    problems: progress.map((p) => ({
      problemOrder: p.problemOrder,
      status: p.status as 'LOCKED' | 'UNLOCKED' | 'SOLVED',
      passed: null,
      total: null,
      wrongSubmissions: p.wrongSubmissions,
    })),
    raceProgress: totalProblems > 0 ? solvedCount / totalProblems : 0,
    solvedCount,
    totalProblems,
  };
}

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

    if (code.length > 64000) {
      return NextResponse.json({ error: 'Code exceeds maximum length (64KB)' }, { status: 413 });
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

    // Already solved — no resubmission
    if (progress.status === 'SOLVED') {
      return NextResponse.json({ error: 'Already solved' }, { status: 409 });
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
    let result;
    try {
      result = await judgeSubmission({
        language: langConfig,
        source: code,
        testCases: testCases.map((tc) => ({ input: tc.input, expected: tc.expectedOutput })),
        timeLimitMs: problem.timeLimitMs,
        memoryLimitMb: problem.memoryLimitMb,
      });
    } catch (judgeErr) {
      const msg = judgeErr instanceof Error ? judgeErr.message : String(judgeErr);
      await db.submission.update({
        where: { id: submission.id },
        data: { verdict: 'CE', passed: 0, error: `Judge error: ${msg.slice(0, 2000)}` },
      });
      return NextResponse.json({
        submissionId: submission.id,
        verdict: 'CE',
        passed: 0,
        total: testCases.length,
        timeMs: null,
        memoryKb: null,
        error: `Judge error: ${msg.slice(0, 2000)}`,
        earlyFinish: false,
        matchStatus: 'IN_PROGRESS',
        nextProblem: null,
        winnerId: null,
      });
    }

    // Update submission and progress atomically after judging
    const postJudgeResult = await db.$transaction(async (tx) => {
      await tx.submission.update({
        where: { id: submission.id },
        data: {
          verdict: result.verdict,
          passed: result.passed,
          timeMs: result.timeMs,
          memoryKb: result.memoryKb,
          error: result.compileError ?? result.runtimeError ?? null,
        },
      });

      let earlyFinish = false;
      let matchStatus = 'IN_PROGRESS';
      let nextProblem = null;
      let winnerId = null;

      // If SUBMIT and AC, update progress and unlock next problem
      if (submissionMode === 'SUBMIT' && result.verdict === 'AC') {
        await tx.matchProgress.update({
          where: { id: progress.id },
          data: {
            status: 'SOLVED',
            solvedAt: new Date(),
            scoreEarned:
              problem.points - progress.wrongSubmissions * MATCH_CONFIG.wrongSubmissionPenalty,
          },
        });

        // Unlock next problem in the sequence (by problemOrder)
        const nextOrder = progress.problemOrder + 1;
        const nextProgress = match.progress.find(
          (p) => p.userId === user.id && p.problemOrder === nextOrder,
        );
        if (nextProgress) {
          await tx.matchProgress.update({
            where: { id: nextProgress.id },
            data: { status: 'UNLOCKED', unlockedAt: new Date() },
          });
          const nextProb = await tx.problem.findUnique({ where: { id: nextProgress.problemId } });
          nextProblem = nextProb ? { slug: nextProb.slug, problemId: nextProb.id, problemOrder: nextProgress.problemOrder } : null;
        }

        // Check for early finish
        const updatedProgress = await tx.matchProgress.findMany({
          where: { matchId: match.id, userId: user.id },
        });
        const allDone = updatedProgress.every((p) => p.status === 'SOLVED');

        if (allDone) {
          earlyFinish = true;
          matchStatus = 'COMPLETED';
          winnerId = user.id;
        }
      }

      // If SUBMIT and not AC, increment wrong submissions
      if (submissionMode === 'SUBMIT' && result.verdict !== 'AC') {
        await tx.matchProgress.update({
          where: { id: progress.id },
          data: { wrongSubmissions: { increment: 1 } },
        });
      }

      return { earlyFinish, matchStatus, nextProblem, winnerId };
    });

    // If early finish was detected, finalize the match
    if (postJudgeResult.earlyFinish) {
      try {
        const finalResult = await finalizeMatch({
          matchId: match.id,
          reason: 'early_finish',
        });
        postJudgeResult.winnerId = finalResult?.winnerId ?? user.id;

        // Emit match:end to both players
        const matchData = await db.match.findUnique({ where: { id: matchId } });
        if (matchData) {
          const endPayload: MatchEndPayload = {
            matchId,
            status: 'COMPLETED',
            winnerId: matchData.winnerId,
            scoreA: matchData.scoreA,
            scoreB: matchData.scoreB,
            eloDeltaA: matchData.eloDeltaA,
            eloDeltaB: matchData.eloDeltaB,
            reason: 'early_finish',
          };
          await emitToMatch(matchId, 'match:end', endPayload);
        }
      } catch (e) {
        console.error('[submit] early finish finalization failed:', e);
      }
    }

    // --- Emit Socket.IO events ---

    // 1. Emit submission verdict to the match room (both players see it)
    const verdictPayload: SubmissionVerdictPayload = {
      matchId,
      submissionId: submission.id,
      problemId,
      problemOrder: progress.problemOrder,
      verdict: result.verdict as SubmissionVerdictPayload['verdict'],
      passed: result.passed,
      total: result.total,
      timeMs: result.timeMs,
      memoryKb: result.memoryKb,
      error: result.compileError ?? result.runtimeError ?? undefined,
    };
    await emitToMatch(matchId, 'submission:verdict', verdictPayload);

    // 2. Emit opponent progress snapshot to the match room
    const opponentId = user.id === match.playerAId ? match.playerBId : match.playerAId;
    const playerSnapshot = await buildOpponentSnapshot(matchId, user.id, match.totalProblems);
    const opponentSnapshot = await buildOpponentSnapshot(matchId, opponentId, match.totalProblems);
    await emitToMatch(matchId, 'opponent:progress', playerSnapshot);
    await emitToMatch(matchId, 'opponent:progress', opponentSnapshot);

    // 3. If a problem was unlocked, notify the submitting player
    if (postJudgeResult.nextProblem) {
      const { emitSocketEvent } = await import('@/lib/socket');
      await emitSocketEvent(`user:${user.id}`, 'problem:unlocked', {
        problemOrder: postJudgeResult.nextProblem.problemOrder,
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
      earlyFinish: postJudgeResult.earlyFinish,
      matchStatus: postJudgeResult.matchStatus,
      nextProblem: postJudgeResult.nextProblem,
      winnerId: postJudgeResult.winnerId,
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
