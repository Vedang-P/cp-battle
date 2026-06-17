import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { db } from '@cp-battle/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { matchId: string } },
) {
  try {
    const user = await requireUser();
    const { matchId } = params;

    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        progress: { where: { userId: user.id } },
        easy: true,
        medium: true,
        hard: true,
      },
    });

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    if (match.playerAId !== user.id && match.playerBId !== user.id) {
      return NextResponse.json({ error: 'Not your match' }, { status: 403 });
    }

    const progressMap = new Map(match.progress.map((p) => [p.difficulty, p]));

    const problems = [
      { ...match.easy, progress: progressMap.get('EASY') ?? null },
      { ...match.medium, progress: progressMap.get('MEDIUM') ?? null },
      { ...match.hard, progress: progressMap.get('HARD') ?? null },
    ].map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      difficulty: p.difficulty,
      descriptionMd: p.descriptionMd,
      timeLimitMs: p.timeLimitMs,
      memoryLimitMb: p.memoryLimitMb,
      points: p.points,
      starterCode: p.starterCode,
      progress: p.progress
        ? {
            status: p.progress.status,
            wrongSubmissions: p.progress.wrongSubmissions,
            scoreEarned: p.progress.scoreEarned,
          }
        : { status: 'LOCKED', wrongSubmissions: 0, scoreEarned: 0 },
    }));

    return NextResponse.json({ problems });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
