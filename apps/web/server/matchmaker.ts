/**
 * Matchmaking worker — polls the Redis queue and creates matches.
 *
 * Runs as a separate process (`pnpm dev:matchmaker`). Pairs players whose
 * ELO gap fits their time-widened matchmaking window.
 */

import { findPair, dequeue, createMatch } from '@cp-battle/match';
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const POLL_INTERVAL_MS = 2000;

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

async function poll() {
  try {
    const pair = await findPair(redis, Date.now());
    if (!pair) return;

    const [playerAId, playerBId] = pair;
    console.log(`[matchmaker] Pairing ${playerAId} vs ${playerBId}`);

    // Remove both from queue
    await Promise.all([
      dequeue(redis, playerAId),
      dequeue(redis, playerBId),
    ]);

    // Create the match
    const matchId = await createMatch(playerAId, playerBId);
    console.log(`[matchmaker] Match created: ${matchId}`);
  } catch (err) {
    console.error('[matchmaker] Error:', err);
  }
}

console.log('[matchmaker] Starting matchmaking worker...');
setInterval(poll, POLL_INTERVAL_MS);
