import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@zapdos/db';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
  }

  const { username } = await req.json();
  const trimmed = username?.trim().toLowerCase();

  if (!trimmed || trimmed.length < 3 || trimmed.length > 20) {
    return NextResponse.json({ error: 'handle must be 3-20 characters' }, { status: 400 });
  }
  if (!/^[a-z0-9_-]+$/.test(trimmed)) {
    return NextResponse.json({ error: 'only lowercase letters, numbers, _ and - allowed' }, { status: 400 });
  }

  // Check if handle is already taken
  const existing = await db.user.findUnique({ where: { username: trimmed } });
  if (existing && existing.id !== session.user.id) {
    return NextResponse.json({ error: 'handle already taken' }, { status: 409 });
  }

  // Update username and mark onboarding complete
  await db.user.update({
    where: { id: session.user.id },
    data: {
      username: trimmed,
      onboardingComplete: true,
    },
  });

  return NextResponse.json({ ok: true, username: trimmed });
}
