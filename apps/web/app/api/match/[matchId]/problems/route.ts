import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { db } from '@cp-battle/db';
import { isValidId } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { matchId: string } },
) {
  try {
    const user = await requireUser();
    const { matchId } = params;

    if (!isValidId(matchId)) {
      return NextResponse.json({ error: 'Invalid match ID' }, { status: 400 });
    }

    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        progress: { where: { userId: user.id } },
      },
    });

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    if (match.playerAId !== user.id && match.playerBId !== user.id) {
      return NextResponse.json({ error: 'Not your match' }, { status: 403 });
    }

    // Load all problems in the sequence
    const problemIds = match.problemSequence;
    const dbProblems = await db.problem.findMany({
      where: { id: { in: problemIds } },
    });
    const problemMap = new Map(dbProblems.map((p) => [p.id, p]));

    const progressMap = new Map(match.progress.map((p) => [p.problemId, p]));

    const problems = problemIds.map((id, index) => {
      const p = problemMap.get(id);
      const prog = progressMap.get(id);
      return {
        id: p?.id ?? id,
        slug: p?.slug ?? '',
        title: p?.title ?? '',
        descriptionMd: p?.descriptionMd ?? '',
        timeLimitMs: p?.timeLimitMs ?? 2000,
        memoryLimitMb: p?.memoryLimitMb ?? 256,
        points: p?.points ?? 100,
        starterCode: p?.starterCode ?? {},
        problemOrder: index,
        progress: prog
          ? {
              status: prog.status,
              wrongSubmissions: prog.wrongSubmissions,
              scoreEarned: prog.scoreEarned,
            }
          : { status: 'LOCKED', wrongSubmissions: 0, scoreEarned: 0 },
      };
    });

    return NextResponse.json({
      problems,
      mode: match.mode,
      totalProblems: match.totalProblems,
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
