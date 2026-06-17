import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { redis } from '@/lib/redis';
import { QUEUE_KEY } from '@cp-battle/match';
import { db } from '@cp-battle/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireUser();

    // Check if in queue
    const score = await (redis as any).zscore(QUEUE_KEY, user.id);
    if (score !== null) {
      return NextResponse.json({ status: 'queued' });
    }

    // Check for active match
    const activeMatch = await db.match.findFirst({
      where: {
        status: 'IN_PROGRESS',
        OR: [{ playerAId: user.id }, { playerBId: user.id }],
      },
      include: {
        playerA: { select: { id: true, username: true, elo: true } },
        playerB: { select: { id: true, username: true, elo: true } },
      },
    });

    if (activeMatch) {
      return NextResponse.json({
        status: 'in_match',
        match: {
          id: activeMatch.id,
          endsAt: activeMatch.endsAt?.toISOString(),
          mode: activeMatch.mode,
          opponent:
            activeMatch.playerAId === user.id
              ? activeMatch.playerB
              : activeMatch.playerA,
        },
      });
    }

    return NextResponse.json({ status: 'idle' });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
