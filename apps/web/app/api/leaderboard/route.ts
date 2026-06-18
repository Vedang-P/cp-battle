import { NextResponse } from 'next/server';
import { db } from '@zapdos/db';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

const CACHE_KEY = 'leaderboard:top100';
const CACHE_TTL = 30; // seconds

export async function GET() {
  try {
    // Try cache first
    const cached = await redis.get(CACHE_KEY).catch(() => null);
    if (cached) {
      return NextResponse.json(JSON.parse(cached), {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
      });
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

    return NextResponse.json(users, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
