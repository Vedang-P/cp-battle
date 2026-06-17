import { NextResponse } from 'next/server';
import { db } from '@cp-battle/db';
import { getUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sessionUser = await getUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      username: true,
      email: true,
      elo: true,
      gamesPlayed: true,
      wins: true,
      losses: true,
      draws: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json(user);
}
