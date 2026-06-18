/**
 * Matchmaking worker — polls the Redis queue and creates matches.
 *
 * Runs as a separate process (`pnpm dev:matchmaker`). Pairs players whose
 * ELO gap fits their time-widened matchmaking window.
 *
 * Safety: uses a Redis SET NX lock around the find-pair → dequeue → create
 * pipeline so multiple matchmaker instances can't double-pair a player.
 *
 * After creating a match, emits match:start to both players via the
 * HMAC-authenticated realtime bridge.
 */

import { findPair, dequeue, createMatch, QUEUE_KEY, QUEUE_LOCK_KEY, type RedisLike } from '@cp-battle/match';
import Redis from 'ioredis';
import { db } from '@cp-battle/db';
import { matchRoom } from '@cp-battle/realtime';
import type { MatchStartPayload } from '@cp-battle/realtime';
import { createHmac } from 'node:crypto';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const POLL_INTERVAL_MS = 2000;
const LOCK_TTL_MS = 5000; // 5 seconds — enough for findPair + dequeue + createMatch
const REALTIME_URL = process.env.REALTIME_URL ?? 'http://localhost:3002';
const AUTH_SECRET = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? '';

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

const redisCompat = redis as unknown as RedisLike;
const META_PREFIX = 'cpb:matchmaking:meta:';

/** Emit a socket event via the HMAC-authenticated HTTP bridge. */
async function emitSocketEvent(room: string, event: string, payload: unknown): Promise<boolean> {
  try {
    const body = JSON.stringify({ room, event, payload });
    const sig = createHmac('sha256', AUTH_SECRET).update(body).digest('hex');
    const res = await fetch(`${REALTIME_URL}/emit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Signature': sig,
      },
      body,
    });
    return res.ok;
  } catch (err) {
    console.error(`[matchmaker] Failed to emit ${event} to ${room}:`, err);
    return false;
  }
}

/** Acquire a distributed lock for the matchmaking pipeline. */
async function acquireLock(): Promise<boolean> {
  const result = await redis.set(QUEUE_LOCK_KEY, 'locked', 'PX', LOCK_TTL_MS, 'NX');
  return result === 'OK';
}

/** Release the lock. */
async function releaseLock(): Promise<void> {
  await redis.del(QUEUE_LOCK_KEY);
}

async function poll(): Promise<void> {
  // Acquire lock to prevent double-pairing across instances
  if (!(await acquireLock())) return;

  try {
    const pair = await findPair(redisCompat, Date.now());
    if (!pair) return;

    const [playerAId, playerBId] = pair;

    // Read mode from the first player's queue metadata
    const raw = await redis.get(`${META_PREFIX}${playerAId}`);
    const meta = raw ? JSON.parse(raw) : {};
    const mode = (meta.mode ?? 'SPRINT') as 'SPRINT' | 'PROGRESSIVE';

    console.log(`[matchmaker] Pairing ${playerAId} vs ${playerBId} (${mode})`);

    // Remove both from queue BEFORE creating the match, so a concurrent
    // findPair can't re-pair them. If createMatch fails, they'll need to
    // re-queue — but that's better than double-matching.
    await Promise.all([
      dequeue(redisCompat, playerAId),
      dequeue(redisCompat, playerBId),
    ]);

    // Create the match
    const matchId = await createMatch(playerAId, playerBId, mode);
    console.log(`[matchmaker] Match created: ${matchId} (${mode})`);

    // Fetch full match data to build match:start payload
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        progress: {
          include: { problem: true },
          orderBy: { problemOrder: 'asc' },
        },
        playerA: { select: { id: true, username: true, elo: true } },
        playerB: { select: { id: true, username: true, elo: true } },
      },
    });

    if (!match) {
      console.error(`[matchmaker] Match ${matchId} not found after creation`);
      return;
    }

    // Build the problem brief list (same for both players)
    const problems = match.progress
      .filter((p) => p.userId === playerAId)
      .map((p) => ({
        problemId: p.problemId,
        problemOrder: p.problemOrder,
        slug: p.problem.slug,
        title: p.problem.title,
        starterCode: p.problem.starterCode as Record<string, string>,
        timeLimitMs: p.problem.timeLimitMs,
        memoryLimitMb: p.problem.memoryLimitMb,
      }));

    // Emit match:start to both players (each gets their own opponent view)
    const payloadA: MatchStartPayload = {
      matchId,
      endsAt: (match.endsAt ?? new Date()).toISOString(),
      durationSeconds: match.durationSec,
      mode: match.mode as MatchStartPayload['mode'],
      totalProblems: match.totalProblems,
      opponent: { userId: match.playerB.id, username: match.playerB.username, elo: match.playerB.elo },
      problems,
    };

    const payloadB: MatchStartPayload = {
      matchId,
      endsAt: (match.endsAt ?? new Date()).toISOString(),
      durationSeconds: match.durationSec,
      mode: match.mode as MatchStartPayload['mode'],
      totalProblems: match.totalProblems,
      opponent: { userId: match.playerA.id, username: match.playerA.username, elo: match.playerA.elo },
      problems,
    };

    await Promise.all([
      emitSocketEvent(`user:${playerAId}`, 'match:start', payloadA),
      emitSocketEvent(`user:${playerBId}`, 'match:start', payloadB),
    ]);

    console.log(`[matchmaker] Emitted match:start to both players for ${matchId}`);
  } catch (err) {
    console.error('[matchmaker] Error:', err);
  } finally {
    await releaseLock();
  }
}

// Recursive setTimeout — prevents overlapping polls (unlike setInterval)
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let shuttingDown = false;

function scheduleNextPoll() {
  if (shuttingDown) return;
  pollTimer = setTimeout(async () => {
    await poll();
    scheduleNextPoll();
  }, POLL_INTERVAL_MS);
}

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`[matchmaker] Received ${signal}, shutting down...`);
  shuttingDown = true;
  if (pollTimer) clearTimeout(pollTimer);
  redis.disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => console.error('[matchmaker] Unhandled rejection:', err));
process.on('uncaughtException', (err) => console.error('[matchmaker] Uncaught exception:', err));

console.log('[matchmaker] Starting matchmaking worker...');
scheduleNextPoll();
