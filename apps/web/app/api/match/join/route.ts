import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { redis } from '@/lib/redis';
import { enqueue, dequeue, QUEUE_KEY } from '@cp-battle/match';
import { db } from '@cp-battle/db';

// ioredis Redis satisfies RedisLike at runtime; cast to satisfy TS
const queueRedis = redis as any;

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await requireUser();

    // Read optional mode from request body
    let mode = 'SPRINT';
    try {
      const body = await req.json();
      if (body.mode === 'SPRINT' || body.mode === 'PROGRESSIVE') {
        mode = body.mode;
      }
    } catch {
      // No body or invalid JSON — default to SPRINT
    }

    // Check if already in queue
    const score = await queueRedis.zscore(QUEUE_KEY, user.id);
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

    await enqueue(queueRedis, {
      userId: user.id,
      elo: dbUser.elo,
      joinedAtMs: Date.now(),
      mode,
    });

    return NextResponse.json({ status: 'queued', mode });
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
    await dequeue(queueRedis, user.id);
    return NextResponse.json({ status: 'dequeued' });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
