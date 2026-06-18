import { NextResponse } from 'next/server';
import { db } from '@zapdos/db';
import { hashPassword } from '@/lib/password';
import { signupSchema } from '@/lib/schemas';
import { checkIpSignupLimit } from '@/lib/rate-limit';

function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

export async function POST(req: Request) {
  try {
    // IP-based abuse prevention: 5 signups per IP per hour
    const ip = getClientIp(req);
    const rateLimit = await checkIpSignupLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: rateLimit.reason, retryAfterMs: rateLimit.retryAfterMs },
        { status: 429 },
      );
    }

    const body = await req.json();
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { username, email, password } = parsed.data;

    const existing = await db.user.findFirst({
      where: { OR: [{ email: email.toLowerCase() }, { username }] },
    });
    if (existing) {
      const field = existing.email === email.toLowerCase() ? 'email' : 'username';
      return NextResponse.json({ error: { [field]: ['Already taken'] } }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: { email: email.toLowerCase(), username, passwordHash },
      select: { id: true, username: true, email: true },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
