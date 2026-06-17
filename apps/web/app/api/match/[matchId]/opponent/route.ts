import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { db } from '@cp-battle/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { matchId: string } },
) {
  try {
    const user = await requireUser();
    const { matchId } = params;

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

    const opponentId =
      match.playerAId === user.id ? match.playerBId : match.playerAId;

    const opponent = await db.user.findUnique({
      where: { id: opponentId },
      select: { id: true, username: true, elo: true },
    });

    const getProgress = (userId: string) => {
      const rows = match.progress
        .filter((p) => p.userId === userId)
        .sort((a, b) => a.problemOrder - b.problemOrder);
      return rows.map((p) => ({
        problemOrder: p.problemOrder,
        status: p.status,
        wrongSubmissions: p.wrongSubmissions,
        scoreEarned: p.scoreEarned,
      }));
    };

    const getSolvedCount = (userId: string) =>
      match.progress.filter((p) => p.userId === userId && p.status === 'SOLVED').length;

    const getScore = (userId: string) =>
      match.progress
        .filter((p) => p.userId === userId)
        .reduce((s, p) => s + p.scoreEarned, 0);

    const opponentProgress = getProgress(opponentId);
    const playerProgress = getProgress(user.id);

    const playerSolved = getSolvedCount(user.id);
    const opponentSolved = getSolvedCount(opponentId);
    const totalProblems = match.totalProblems;

    const isPlayerA = match.playerAId === user.id;

    return NextResponse.json({
      opponent,
      opponentProgress,
      playerProgress,
      scores: {
        player: getScore(user.id),
        opponent: getScore(opponentId),
      },
      // Race progress: 0..1 for each player's car position
      raceProgress: {
        player: playerSolved / totalProblems,
        opponent: opponentSolved / totalProblems,
      },
      solvedCount: {
        player: playerSolved,
        opponent: opponentSolved,
      },
      totalProblems,
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
