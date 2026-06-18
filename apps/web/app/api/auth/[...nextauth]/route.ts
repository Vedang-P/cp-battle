import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redis } from '@/lib/redis';
import { NextRequest, NextResponse } from 'next/server';

const RATE_LIMIT_KEY = 'ratelimit:login:';
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const INCR_EXPIRE_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return count
`;

async function checkLoginRateLimit(ip: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const key = RATE_LIMIT_KEY + ip;
  try {
    const count = (await redis.eval(INCR_EXPIRE_SCRIPT, 1, key, WINDOW_MS)) as number;
    if (count > MAX_ATTEMPTS) {
      const ttl = await redis.pttl(key);
      return { allowed: false, retryAfter: Math.ceil(ttl / 1000) };
    }
    return { allowed: true };
  } catch {
    // Fail open — if Redis is down, allow the request
    return { allowed: true };
  }
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? 'unknown';
  }
  return 'unknown';
}

const handler = NextAuth(authOptions);

async function rateLimitedHandler(req: NextRequest, context: { params: { nextauth: string[] } }) {
  // Only rate-limit POST (login attempts), not GET (session checks)
  if (req.method === 'POST') {
    const ip = getClientIp(req);
    const { allowed, retryAfter } = await checkLoginRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } },
      );
    }
  }
  return handler(req, context);
}

export { rateLimitedHandler as GET, rateLimitedHandler as POST };
