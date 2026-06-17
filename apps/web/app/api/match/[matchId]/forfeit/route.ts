import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { db } from '@cp-battle/db';
import { finalizeMatch } from '@cp-battle/match';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: { matchId: string } },
) {
  try {
    const user = await requireUser();
    const { matchId } = params;

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

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
