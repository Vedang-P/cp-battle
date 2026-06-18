import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { db } from '@cp-battle/db';
import { createMatch } from '@cp-battle/match';
import { emitToUser } from '@/lib/socket';
import { BOT_EMAIL } from '@/lib/bot-config';
import type { MatchStartPayload } from '@cp-battle/realtime';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await requireUser();

    // Parse difficulty from body
    let difficulty = 'MEDIUM';
    try {
      const body = await req.json();
      if (body.difficulty === 'EASY' || body.difficulty === 'MEDIUM' || body.difficulty === 'HARD') {
        difficulty = body.difficulty;
      }
    } catch {
      // Default to MEDIUM
    }

    // Check if user is already in an active match
    const activeMatch = await db.match.findFirst({
      where: {
        status: 'IN_PROGRESS',
        OR: [{ playerAId: user.id }, { playerBId: user.id }],
      },
    });
    if (activeMatch) {
      return NextResponse.json({ error: 'Already in a match' }, { status: 409 });
    }

    // Find or create bot user
    let bot = await db.user.findUnique({ where: { email: BOT_EMAIL } });
    if (!bot) {
      // Auto-create bot if seed hasn't been run
      const { createHash } = await import('crypto');
      const pw = createHash('sha256').update('cp-bot-auto-' + Date.now()).digest('hex');
      bot = await db.user.create({
        data: {
          email: BOT_EMAIL,
          username: 'CP-Bot',
          passwordHash: pw,
          elo: 1200,
        },
      });
    }

    // Create match with bot as playerB
    const matchId = await createMatch(user.id, bot.id, 'SPRINT');

    // Mark as practice match
    await db.match.update({
      where: { id: matchId },
      data: {
        isPractice: true,
        practiceDifficulty: difficulty,
      },
    });

    // Fetch full match data to build match:start payload
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        progress: {
          include: { problem: true },
          orderBy: { problemOrder: 'asc' },
        },
        playerA: { select: { id: true, username: true, elo: true } },
        playerB: { select: { id: true, username: true, elo: true } },
      },
    });

    if (!match) {
      return NextResponse.json({ error: 'Failed to create match' }, { status: 500 });
    }

    // Build the problem brief list
    const problems = match.progress
      .filter((p) => p.userId === user.id)
      .map((p) => ({
        problemId: p.problemId,
        problemOrder: p.problemOrder,
        slug: p.problem.slug,
        title: p.problem.title,
        starterCode: p.problem.starterCode as Record<string, string>,
        timeLimitMs: p.problem.timeLimitMs,
        memoryLimitMb: p.problem.memoryLimitMb,
      }));

    // Emit match:start to the human player
    const payload: MatchStartPayload = {
      matchId,
      endsAt: (match.endsAt ?? new Date()).toISOString(),
      durationSeconds: match.durationSec,
      mode: match.mode as MatchStartPayload['mode'],
      totalProblems: match.totalProblems,
      opponent: { userId: bot.id, username: bot.username, elo: bot.elo },
      problems,
    };

    await emitToUser(user.id, 'match:start', payload);

    return NextResponse.json({
      matchId,
      status: 'in_match',
      difficulty,
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[practice] Error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
