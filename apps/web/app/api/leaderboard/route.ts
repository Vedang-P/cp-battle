import { NextResponse } from 'next/server';
import { db } from '@cp-battle/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
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

    return NextResponse.json(users);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
