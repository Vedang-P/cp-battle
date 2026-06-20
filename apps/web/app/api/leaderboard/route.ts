import { NextResponse } from 'next/server';
import { db } from '@zapdos/db';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

const CACHE_KEY = 'leaderboard:top100';
const LOCK_KEY = 'leaderboard:lock';
const CACHE_TTL = 30; // seconds
const HEADERS = { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' };

export async function GET() {
  try {
    // Try cache first
    const cached = await redis.get(CACHE_KEY).catch(() => null);
    if (cached) {
      return NextResponse.json(JSON.parse(cached), { headers: HEADERS });
    }

    // Cache miss — stampede guard: only one request rebuilds at a time. Losers
    // wait briefly and re-read the cache the winner just populated, so a burst
    // of traffic on expiry doesn't all hit Postgres at once.
    const gotLock = await redis
      .set(LOCK_KEY, '1', 'EX', 10, 'NX')
      .catch(() => null);
    if (!gotLock) {
      await new Promise((r) => setTimeout(r, 100));
      const retry = await redis.get(CACHE_KEY).catch(() => null);
      if (retry) return NextResponse.json(JSON.parse(retry), { headers: HEADERS });
      // Fall through and query directly if the cache still isn't ready.
    }

    const users = await db.user.findMany({
      orderBy: [{ elo: 'desc' }, { wins: 'desc' }],
      take: 100,
      select: {
        id: true,
        username: true,
        elo: true,
        gamesPlayed: true,
        wins: true,
        losses: true,
        draws: true,
      },
    });

    // Cache the result
    await redis.set(CACHE_KEY, JSON.stringify(users), 'EX', CACHE_TTL).catch(() => {});
    if (gotLock) await redis.del(LOCK_KEY).catch(() => {});

    return NextResponse.json(users, { headers: HEADERS });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
