import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { redis } from '@/lib/redis';
import { enqueue, dequeue, QUEUE_KEY } from '@cp-battle/match';
import { db } from '@cp-battle/db';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const user = await requireUser();

    // Check if already in queue
    const score = await redis.zscore(QUEUE_KEY, user.id);
    if (score !== null) {
      return NextResponse.json({ status: 'already_queued' });
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

    const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { elo: true } });
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await enqueue(redis, {
      userId: user.id,
      elo: dbUser.elo,
      joinedAtMs: Date.now(),
    });

    return NextResponse.json({ status: 'queued' });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    await dequeue(redis, user.id);
    return NextResponse.json({ status: 'dequeued' });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
