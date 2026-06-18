import { NextResponse } from 'next/server';
import { db } from '@zapdos/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const feedbackSchema = z.object({
  message: z.string().min(1, 'Message is required').max(2000, 'Message too long'),
});

// POST /api/feedback — submit anonymous feedback
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = feedbackSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors.message?.[0] ?? 'Invalid input' },
        { status: 400 },
      );
    }

    // Try to get userId from session (optional)
    let userId: string | null = null;
    try {
      const { getServerSession } = await import('next-auth');
      const session = await getServerSession();
      if (session?.user?.id) {
        userId = session.user.id;
      }
    } catch {
      // Not authenticated — that's fine, submit anonymously
    }

    await db.feedback.create({
      data: {
        message: parsed.data.message,
        userId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[feedback] POST error:', e);
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }
}

// GET /api/feedback — read all feedback (admin only in future, open for now)
export async function GET() {
  try {
    const feedback = await db.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        message: true,
        createdAt: true,
        user: { select: { username: true } },
      },
    });

    return NextResponse.json(
      feedback.map((f) => ({
        id: f.id,
        message: f.message,
        username: f.user?.username ?? 'anonymous',
        createdAt: f.createdAt,
      })),
    );
  } catch (e) {
    console.error('[feedback] GET error:', e);
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
  }
}
