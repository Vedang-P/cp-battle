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
      include: {
        playerA: { select: { id: true, username: true, elo: true } },
        playerB: { select: { id: true, username: true, elo: true } },
        progress: true,
      },
    });

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    if (match.playerAId !== user.id && match.playerBId !== user.id) {
      return NextResponse.json({ error: 'Not your match' }, { status: 403 });
    }

    return NextResponse.json({
      match: {
        id: match.id,
        status: match.status,
        playerA: match.playerA,
        playerB: match.playerB,
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        eloDeltaA: match.eloDeltaA,
        eloDeltaB: match.eloDeltaB,
        winnerId: match.winnerId,
        endReason: match.endReason,
        progress: match.progress,
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
