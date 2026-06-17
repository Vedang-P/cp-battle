/**
 * Matchmaking worker — polls the Redis queue and creates matches.
 *
 * Runs as a separate process (`pnpm dev:matchmaker`). Pairs players whose
 * ELO gap fits their time-widened matchmaking window.
 */

import { findPair, dequeue, createMatch, QUEUE_KEY, type RedisLike } from '@cp-battle/match';
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const POLL_INTERVAL_MS = 2000;

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

// Cast ioredis instance to the minimal RedisLike interface used by @cp-battle/match
const redisCompat = redis as unknown as RedisLike;

const META_PREFIX = 'cpb:matchmaking:meta:';

async function poll() {
  try {
    const pair = await findPair(redisCompat, Date.now());
    if (!pair) return;

    const [playerAId, playerBId] = pair;

    // Read mode from the first player's queue metadata
    const raw = await redis.get(`${META_PREFIX}${playerAId}`);
    const meta = raw ? JSON.parse(raw) : {};
    const mode = (meta.mode ?? 'SPRINT') as 'SPRINT' | 'PROGRESSIVE';

    console.log(`[matchmaker] Pairing ${playerAId} vs ${playerBId} (${mode})`);

    // Remove both from queue
    await Promise.all([
      dequeue(redisCompat, playerAId),
      dequeue(redisCompat, playerBId),
    ]);

    // Create the match
    const matchId = await createMatch(playerAId, playerBId, mode);
    console.log(`[matchmaker] Match created: ${matchId} (${mode})`);
  } catch (err) {
    console.error('[matchmaker] Error:', err);
  }
}

console.log('[matchmaker] Starting matchmaking worker...');
setInterval(poll, POLL_INTERVAL_MS);
