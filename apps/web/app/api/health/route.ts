/**
 * Health check endpoint.
 *
 * Probes Postgres, Redis, and Piston so we can tell at a glance which service
 * is misbehaving. Used during Phase 0 bring-up and as a future liveness probe.
 *
 *   GET /api/health -> { status, services: {...}, ts }
 */

import { NextResponse } from 'next/server';
import { db } from '@cp-battle/db';
import { pingPiston } from '@cp-battle/judge';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

async function probe<T>(name: string, fn: () => Promise<T>): Promise<[string, T | { error: string }]> {
  try {
    const result = await fn();
    return [name, result as T | { error: string }];
  } catch (e) {
    return [name, { error: e instanceof Error ? e.message : String(e) }];
  }
}

export async function GET() {
  const [pg, cache, judge] = await Promise.all([
    probe('postgres', async () => {
      const result = await db.$queryRaw`SELECT 1 AS ok`;
      return result;
    }),
    probe('redis', async () => {
      const pong = await redis.ping();
      return pong;
    }),
    probe('piston', async () => pingPiston()),
  ]);

  const services = { [pg[0]]: pg[1], [cache[0]]: cache[1], [judge[0]]: judge[1] };
  const allOk = !Object.values(services).some((v) => v && typeof v === 'object' && 'error' in v);

  return NextResponse.json(
    { status: allOk ? 'ok' : 'degraded', services, ts: new Date().toISOString() },
    { status: allOk ? 200 : 503 },
  );
}
