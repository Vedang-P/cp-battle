import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@zapdos/db';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
  }

  // Rate limit handle changes: 10/min, 50/hr, 200/day (reuse submission limiter)
  const rateLimit = await checkRateLimit(`claim-handle:${session.user.id}`);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many handle change attempts. Try again later.', retryAfterMs: rateLimit.retryAfterMs },
      { status: 429 },
    );
  }

  const { username } = await req.json();
  const trimmed = username?.trim().toLowerCase();

  if (!trimmed || trimmed.length < 3 || trimmed.length > 20) {
    return NextResponse.json({ error: 'handle must be 3-20 characters' }, { status: 400 });
  }
  if (!/^[a-z0-9_-]+$/.test(trimmed)) {
    return NextResponse.json({ error: 'only lowercase letters, numbers, _ and - allowed' }, { status: 400 });
  }

  // Check if handle is already taken (advisory; DB unique constraint is the hard guard)
  const existing = await db.user.findUnique({ where: { username: trimmed } });
  if (existing && existing.id !== session.user.id) {
    return NextResponse.json({ error: 'handle already taken' }, { status: 409 });
  }

  try {
    // Update username and mark onboarding complete
    await db.user.update({
      where: { id: session.user.id },
      data: {
        username: trimmed,
        onboardingComplete: true,
      },
    });
  } catch (err: unknown) {
    // Unique constraint violation: another request claimed the same handle
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      return NextResponse.json({ error: 'handle already taken' }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true, username: trimmed });
}
