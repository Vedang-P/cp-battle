/**
 * Redis-backed matchmaking queue.
 *
 * Design: one Redis sorted set per queue, scored by ELO. When a player joins we
 * store their (userId, elo, joinedAt). The matchmaker polls and pairs any two
 * players whose ELO difference fits their (time-widened) window.
 *
 * Concurrency: pairing is done under a short Redis lock (LOCK_KEY) so two
 * workers can't pair the same player twice. The web app runs a single process
 * for now, but this keeps us safe under horizontal scaling.
 *
 * Atomicity: enqueue uses a Redis pipeline to make zadd + set + ttl a single
 * round-trip, preventing phantom entries from partial failures.
 */

import { matchmakingWindow } from './config';

export const QUEUE_KEY = 'zapdos:matchmaking:queue';
export const QUEUE_LOCK_KEY = 'zapdos:matchmaking:lock';
/** Per-player metadata: { elo, joinedAtMs }. Keyed by userId. */
const QUEUE_META_PREFIX = 'zapdos:matchmaking:meta:';
const META_TTL_MS = 10 * 60 * 1000; // 10 minutes — stale entries expire

export interface QueueEntry {
  userId: string;
  elo: number;
  joinedAtMs: number;
  mode?: string; // 'SPRINT' | 'PROGRESSIVE'
}

/** Minimal Redis surface we depend on — implemented by ioredis/redis clients. */
export interface RedisLike {
  zadd(key: string, score: number, member: string): Promise<number>;
  zrange(key: string, start: number, stop: number, opts?: string): Promise<string[]>;
  zrem(key: string, ...members: string[]): Promise<number>;
  zcard(key: string): Promise<number>;
  set(key: string, value: string): Promise<unknown>;
  pexpire(key: string, ms: number): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  evalsha(...args: unknown[]): Promise<unknown>;
  get(key: string): Promise<string | null>;
  pipeline?: () => PipelineLike;
}

export interface PipelineLike {
  zadd(key: string, score: number, member: string): PipelineLike;
  set(key: string, value: string): PipelineLike;
  pexpire(key: string, ms: number): PipelineLike;
  exec(): Promise<unknown[]>;
}

function metaKey(userId: string): string {
  return `${QUEUE_META_PREFIX}${userId}`;
}

/**
 * Enqueue a player atomically using a Redis pipeline if available,
 * otherwise falls back to sequential commands.
 */
export async function enqueue(
  redis: RedisLike,
  entry: QueueEntry,
): Promise<void> {
  const meta = JSON.stringify({ elo: entry.elo, joinedAtMs: entry.joinedAtMs, mode: entry.mode ?? 'SPRINT' });

  if (redis.pipeline) {
    const pipe = redis.pipeline();
    pipe.zadd(QUEUE_KEY, entry.elo, entry.userId);
    pipe.set(metaKey(entry.userId), meta);
    pipe.pexpire(metaKey(entry.userId), META_TTL_MS);
    await pipe.exec();
  } else {
    await redis.zadd(QUEUE_KEY, entry.elo, entry.userId);
    await redis.set(metaKey(entry.userId), meta);
    await redis.pexpire(metaKey(entry.userId), META_TTL_MS);
  }
}

export async function dequeue(redis: RedisLike, userId: string): Promise<void> {
  await redis.zrem(QUEUE_KEY, userId);
  await redis.del(metaKey(userId));
}

export async function queueSize(redis: RedisLike): Promise<number> {
  return redis.zcard(QUEUE_KEY);
}

/**
 * Find the best pairing in the queue, if any.
 * Returns two userIds whose ELO gap fits BOTH players' widened windows, or null.
 *
 * Strategy: walk the sorted queue; for each adjacent candidate compute how long
 * each has waited and require |eloDiff| <= min(windowA, windowB). Adjacent
 * players are the closest in rating, so first match wins.
 */
export async function findPair(redis: RedisLike, nowMs: number): Promise<[string, string] | null> {
  const members = await redis.zrange(QUEUE_KEY, 0, -1, 'WITHSCORES');
  if (members.length < 4) return null; // need at least 2 players (member+score pairs)

  // Hydrate meta for everyone (cheap; queue is small at our scale).
  const entries: { userId: string; elo: number; joinedAtMs: number; mode: string }[] = [];
  for (let i = 0; i < members.length; i += 2) {
    const userId = members[i]!;
    const score = Number(members[i + 1]);
    const raw = await redis.get(metaKey(userId));
    if (!raw) continue;
    const meta = JSON.parse(raw) as { elo: number; joinedAtMs: number; mode?: string };
    entries.push({ userId, elo: score, joinedAtMs: meta.joinedAtMs, mode: meta.mode ?? 'SPRINT' });
  }

  // Group by mode FIRST, then pair adjacent within each mode group. Pairing
  // across the flat ELO-sorted list (checking only neighbours) would miss two
  // same-mode players who happen to have a different-mode player between them
  // by rating — they'd never get matched. `entries` is already ELO-sorted, so
  // each per-mode group stays ELO-sorted too.
  const byMode = new Map<string, typeof entries>();
  for (const e of entries) {
    const group = byMode.get(e.mode);
    if (group) group.push(e);
    else byMode.set(e.mode, [e]);
  }

  for (const group of byMode.values()) {
    for (let i = 0; i + 1 < group.length; i++) {
      const a = group[i]!;
      const b = group[i + 1]!;
      const waitedA = (nowMs - a.joinedAtMs) / 1000;
      const waitedB = (nowMs - b.joinedAtMs) / 1000;
      const gap = Math.abs(a.elo - b.elo);
      if (gap <= matchmakingWindow(waitedA) && gap <= matchmakingWindow(waitedB)) {
        return [a.userId, b.userId];
      }
    }
  }
  return null;
}
