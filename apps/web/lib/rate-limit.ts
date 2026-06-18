/**
 * Redis-based sliding window rate limiter.
 *
 * Three tiers: per-minute (10), per-hour (50), per-day (200).
 * Returns { allowed: true } or { allowed: false, retryAfterMs, reason }.
 */

import { redis } from './redis';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterMs?: number;
  reason?: string;
}

interface WindowConfig {
  name: string;
  limit: number;
  windowMs: number;
}

const WINDOWS: WindowConfig[] = [
  { name: 'min', limit: 10, windowMs: 60_000 },
  { name: 'hr', limit: 50, windowMs: 3_600_000 },
  { name: 'day', limit: 200, windowMs: 86_400_000 },
];

export async function checkRateLimit(
  key: string,
): Promise<RateLimitResult> {
  const now = Date.now();

  // Pipeline all Redis calls for efficiency
  const pipe = redis.pipeline();
  const windowKeys: { key: string; limit: number; windowMs: number }[] = [];

  for (const window of WINDOWS) {
    const windowKey = `rl:${key}:${window.name}:${Math.floor(now / window.windowMs)}`;
    windowKeys.push({ key: windowKey, limit: window.limit, windowMs: window.windowMs });
    pipe.incr(windowKey);
  }

  const results = await pipe.exec();

  // Check each window for limit violations
  for (let i = 0; i < windowKeys.length; i++) {
    const wk = windowKeys[i];
    if (!wk) continue;
    const count = (results?.[i]?.[1] as number) ?? 0;
    const { key: windowKey, limit, windowMs } = wk;

    if (count === 1) {
      // Set expiry on first hit (fire-and-forget)
      redis.pexpire(windowKey, windowMs).catch(() => {});
    }

    if (count > limit) {
      const windowStart = Math.floor(now / windowMs) * windowMs;
      const retryAfterMs = windowStart + windowMs - now;
      return {
        allowed: false,
        limit,
        remaining: 0,
        retryAfterMs,
        reason: `Rate limit exceeded: ${limit} per ${wk.key.includes('min') ? 'min' : wk.key.includes('hr') ? 'hr' : 'day'}`,
      };
    }
  }

  // All windows passed — return the tightest window's remaining count
  const dayKey = `rl:${key}:day:${Math.floor(now / 86_400_000)}`;
  const remaining = await redis.get(dayKey);
  return {
    allowed: true,
    limit: 200,
    remaining: Math.max(0, 200 - (Number(remaining) || 0)),
  };
}

export async function checkIpSignupLimit(ip: string): Promise<RateLimitResult> {
  const now = Date.now();
  const hourKey = `rl:signup:${ip}:${Math.floor(now / 3_600_000)}`;

  const pipe = redis.pipeline();
  pipe.incr(hourKey);
  const results = await pipe.exec();
  const count = (results?.[0]?.[1] as number) ?? 0;

  if (count === 1) {
    redis.pexpire(hourKey, 3_600_000).catch(() => {});
  }

  if (count > 5) {
    const windowStart = Math.floor(now / 3_600_000) * 3_600_000;
    return {
      allowed: false,
      limit: 5,
      remaining: 0,
      retryAfterMs: windowStart + 3_600_000 - now,
      reason: 'Too many signup attempts. Try again later.',
    };
  }

  return {
    allowed: true,
    limit: 5,
    remaining: 5 - count,
  };
}
