import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { db } from '@zapdos/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireUser();

    const matches = await db.match.findMany({
      where: {
        status: 'COMPLETED',
        OR: [{ playerAId: user.id }, { playerBId: user.id }],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        playerA: { select: { id: true, username: true } },
        playerB: { select: { id: true, username: true } },
        winner: { select: { id: true, username: true } },
      },
    });

    return NextResponse.json(matches);
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
