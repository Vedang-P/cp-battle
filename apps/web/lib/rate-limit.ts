/**
 * Redis-based fixed-window rate limiter.
 *
 * Three tiers: per-minute (10), per-hour (50), per-day (200).
 * Returns { allowed: true } or { allowed: false, retryAfterMs, reason }.
 *
 * Uses Lua scripts for atomic INCR+PEXPIRE (prevents keys from never
 * expiring if the process dies between INCR and PEXPIRE).
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

/**
 * Lua script: atomically INCR and set PEXPIRE on first increment.
 * Returns the count after increment.
 */
const INCR_EXPIRE_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return count
`;

export async function checkRateLimit(
  key: string,
): Promise<RateLimitResult> {
  const now = Date.now();

  const windowKeys: { key: string; limit: number; windowMs: number; name: string }[] = [];

  for (const window of WINDOWS) {
    const windowKey = `rl:${key}:${window.name}:${Math.floor(now / window.windowMs)}`;
    windowKeys.push({ key: windowKey, limit: window.limit, windowMs: window.windowMs, name: window.name });
  }

  // Execute all Lua scripts in a pipeline for efficiency
  const pipe = redis.pipeline();
  for (const wk of windowKeys) {
    pipe.eval(INCR_EXPIRE_SCRIPT, 1, wk.key, wk.windowMs);
  }
  const results = await pipe.exec();

  // Check each window for limit violations
  for (let i = 0; i < windowKeys.length; i++) {
    const wk = windowKeys[i];
    if (!wk) continue;
    const count = (results?.[i]?.[1] as number) ?? 0;

    if (count > wk.limit) {
      const windowStart = Math.floor(now / wk.windowMs) * wk.windowMs;
      const retryAfterMs = windowStart + wk.windowMs - now;
      return {
        allowed: false,
        limit: wk.limit,
        remaining: 0,
        retryAfterMs,
        reason: `Rate limit exceeded: ${wk.limit} per ${wk.name}`,
      };
    }
  }

  // All windows passed — return the tightest window's remaining count
  const minKey = windowKeys[0]!;
  const minCount = (results?.[0]?.[1] as number) ?? 0;
  return {
    allowed: true,
    limit: minKey.limit,
    remaining: Math.max(0, minKey.limit - minCount),
  };
}

export async function checkIpSignupLimit(ip: string): Promise<RateLimitResult> {
  const now = Date.now();
  const minKey = `rl:signup:${ip}:min:${Math.floor(now / 60_000)}`;
  const hourKey = `rl:signup:${ip}:hr:${Math.floor(now / 3_600_000)}`;

  const pipe = redis.pipeline();
  pipe.eval(INCR_EXPIRE_SCRIPT, 1, minKey, 60_000);
  pipe.eval(INCR_EXPIRE_SCRIPT, 1, hourKey, 3_600_000);
  const results = await pipe.exec();

  const minCount = (results?.[0]?.[1] as number) ?? 0;
  const hourCount = (results?.[1]?.[1] as number) ?? 0;

  // 50/min allows rapid signups; 200/hr is the safety net
  if (minCount > 50) {
    const windowStart = Math.floor(now / 60_000) * 60_000;
    return {
      allowed: false,
      limit: 50,
      remaining: 0,
      retryAfterMs: windowStart + 60_000 - now,
      reason: 'Too many signup attempts. Try again later.',
    };
  }

  if (hourCount > 200) {
    const windowStart = Math.floor(now / 3_600_000) * 3_600_000;
    return {
      allowed: false,
      limit: 200,
      remaining: 0,
      retryAfterMs: windowStart + 3_600_000 - now,
      reason: 'Too many signup attempts. Try again later.',
    };
  }

  return {
    allowed: true,
    limit: 50,
    remaining: Math.max(0, 50 - minCount),
  };
}
