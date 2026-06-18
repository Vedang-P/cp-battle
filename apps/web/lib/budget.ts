/**
 * Monthly budget tracking for Judge0 costs.
 *
 * Hard cap: 1000 submissions/month per user.
 * Uses a Lua script for atomic INCR+PEXPIRE (prevents keys from never
 * expiring if the process dies between INCR and PEXPIRE).
 */

import { redis } from './redis';
import { NextResponse } from 'next/server';

export const MONTHLY_SUBMISSION_CAP = 1000;

const INCR_EXPIRE_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return count
`;

export async function incrementAndCheckBudget(userId: string): Promise<{
  count: number;
  allowed: boolean;
}> {
  const now = new Date();
  const monthKey = `budget:${userId}:${now.getUTCFullYear()}:${now.getUTCMonth()}`;
  const lastDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59),
  );
  const ttlMs = lastDay.getTime() - now.getTime() + 60_000;

  const count = (await redis.eval(
    INCR_EXPIRE_SCRIPT,
    1,
    monthKey,
    ttlMs,
  )) as number;

  return { count, allowed: count <= MONTHLY_SUBMISSION_CAP };
}

export async function getMonthlyCount(userId: string): Promise<number> {
  const now = new Date();
  const monthKey = `budget:${userId}:${now.getUTCFullYear()}:${now.getUTCMonth()}`;
  const count = await redis.get(monthKey);
  return Number(count) || 0;
}

export function budgetExceededResponse(): NextResponse {
  const now = new Date();
  const nextMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 0, 0, 0),
  );
  return NextResponse.json(
    {
      error:
        'Monthly submission limit reached. The service is temporarily at capacity.',
      retryAfterMs: nextMonth.getTime() - now.getTime(),
    },
    { status: 429 },
  );
}
