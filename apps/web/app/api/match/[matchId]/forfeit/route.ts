import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { db } from '@cp-battle/db';
import { finalizeMatch } from '@cp-battle/match';
import { emitToMatch } from '@/lib/socket';
import { isValidId } from '@/lib/validation';
import type { MatchEndPayload } from '@cp-battle/realtime';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: { matchId: string } },
) {
  try {
    const user = await requireUser();
    const { matchId } = params;

    if (!isValidId(matchId)) {
      return NextResponse.json({ error: 'Invalid match ID' }, { status: 400 });
    }

    const match = await db.match.findUnique({ where: { id: matchId } });
    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    if (match.playerAId !== user.id && match.playerBId !== user.id) {
      return NextResponse.json({ error: 'Not your match' }, { status: 403 });
    }

    if (match.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'Match is not in progress' }, { status: 409 });
    }

    const result = await finalizeMatch({
      matchId,
      reason: 'forfeit',
      forfeiterId: user.id,
    });

    // Fetch updated match data for the end event
    const updatedMatch = await db.match.findUnique({ where: { id: matchId } });
    if (updatedMatch) {
      const endPayload: MatchEndPayload = {
        matchId,
        status: 'COMPLETED',
        winnerId: updatedMatch.winnerId,
        scoreA: updatedMatch.scoreA,
        scoreB: updatedMatch.scoreB,
        eloDeltaA: updatedMatch.eloDeltaA,
        eloDeltaB: updatedMatch.eloDeltaB,
        reason: 'forfeit',
      };
      await emitToMatch(matchId, 'match:end', endPayload);
    }

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
