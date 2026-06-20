import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { db } from '@zapdos/db';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export async function GET(req: Request) {
  try {
    const user = await requireUser();

    // Offset pagination so history beyond the first 50 is reachable.
    const { searchParams } = new URL(req.url);
    const offset = Math.max(0, Number.parseInt(searchParams.get('offset') ?? '0', 10) || 0);

    const matches = await db.match.findMany({
      where: {
        status: 'COMPLETED',
        isPractice: false,
        OR: [{ playerAId: user.id }, { playerBId: user.id }],
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: PAGE_SIZE,
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
