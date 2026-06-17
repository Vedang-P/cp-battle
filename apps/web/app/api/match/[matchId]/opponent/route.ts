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

    const opponentProgress = match.progress
      .filter((p) => p.userId === opponentId)
      .map((p) => ({
        difficulty: p.difficulty,
        status: p.status,
        wrongSubmissions: p.wrongSubmissions,
        scoreEarned: p.scoreEarned,
      }));

    const playerProgress = match.progress
      .filter((p) => p.userId === user.id)
      .map((p) => ({
        difficulty: p.difficulty,
        status: p.status,
        wrongSubmissions: p.wrongSubmissions,
        scoreEarned: p.scoreEarned,
      }));

    const totalA = match.progress
      .filter((p) => p.userId === match.playerAId)
      .reduce((s, p) => s + p.scoreEarned, 0);
    const totalB = match.progress
      .filter((p) => p.userId === match.playerBId)
      .reduce((s, p) => s + p.scoreEarned, 0);

    return NextResponse.json({
      opponent,
      opponentProgress,
      playerProgress,
      scores: {
        player: opponentId === user.id ? totalB : totalA,
        opponent: opponentId === user.id ? totalA : totalB,
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
