/**
 * Monthly budget tracking for Judge0 RapidAPI costs.
 *
 * Hard cap: 1000 submissions/month (~$1.70).
 * Uses Redis INCR with auto-expiring keys per user per month.
 * Resets on the 1st of each month UTC.
 */

import { redis } from './redis';
import { NextResponse } from 'next/server';

export const MONTHLY_SUBMISSION_CAP = 1000;

export async function incrementAndCheckBudget(userId: string): Promise<{
  count: number;
  allowed: boolean;
}> {
  const now = new Date();
  const monthKey = `budget:${userId}:${now.getUTCFullYear()}:${now.getUTCMonth()}`;
  const count = await redis.incr(monthKey);

  if (count === 1) {
    const lastDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59),
    );
    await redis.pexpire(
      monthKey,
      lastDay.getTime() - now.getTime() + 60_000,
    );
  }

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
