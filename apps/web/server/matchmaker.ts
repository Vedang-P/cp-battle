/**
 * Matchmaking worker — polls the Redis queue and creates matches.
 *
 * Runs as a separate process (`pnpm dev:matchmaker`). Pairs players whose
 * ELO gap fits their time-widened matchmaking window.
 *
 * After creating a match, emits match:start to both players via Socket.IO.
 */

import { findPair, dequeue, createMatch, QUEUE_KEY, type RedisLike } from '@cp-battle/match';
import Redis from 'ioredis';
import { db } from '@cp-battle/db';
import { matchRoom } from '@cp-battle/realtime';
import type { MatchStartPayload } from '@cp-battle/realtime';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const POLL_INTERVAL_MS = 2000;
const REALTIME_URL = process.env.REALTIME_URL ?? 'http://localhost:3002';

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

// Cast ioredis instance to the minimal RedisLike interface used by @cp-battle/match
const redisCompat = redis as unknown as RedisLike;

const META_PREFIX = 'cpb:matchmaking:meta:';

/** Emit a socket event via the HTTP bridge. */
async function emitSocketEvent(room: string, event: string, payload: unknown): Promise<boolean> {
  try {
    const res = await fetch(`${REALTIME_URL}/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room, event, payload }),
    });
    return res.ok;
  } catch (err) {
    console.error(`[matchmaker] Failed to emit ${event} to ${room}:`, err);
    return false;
  }
}

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

    // Emit match:start to both players
    const playerAOpponent = { userId: match.playerB.id, username: match.playerB.username, elo: match.playerB.elo };
    const playerBOpponent = { userId: match.playerA.id, username: match.playerA.username, elo: match.playerA.elo };

    const payloadA: MatchStartPayload = {
      matchId,
      endsAt: (match.endsAt ?? new Date()).toISOString(),
      durationSeconds: match.durationSec,
      mode: match.mode as MatchStartPayload['mode'],
      totalProblems: match.totalProblems,
      opponent: playerAOpponent,
      problems,
    };

    const payloadB: MatchStartPayload = {
      matchId,
      endsAt: (match.endsAt ?? new Date()).toISOString(),
      durationSeconds: match.durationSec,
      mode: match.mode as MatchStartPayload['mode'],
      totalProblems: match.totalProblems,
      opponent: playerBOpponent,
      problems,
    };

    // Emit to both player rooms (they may not be in the match room yet)
    await Promise.all([
      emitSocketEvent(`user:${playerAId}`, 'match:start', payloadA),
      emitSocketEvent(`user:${playerBId}`, 'match:start', payloadB),
      // Also emit to the match room for anyone already joined
      emitSocketEvent(matchRoom(matchId), 'match:start', payloadA),
    ]);

    console.log(`[matchmaker] Emitted match:start to both players for ${matchId}`);
  } catch (err) {
    console.error('[matchmaker] Error:', err);
  }
}

console.log('[matchmaker] Starting matchmaking worker...');
setInterval(poll, POLL_INTERVAL_MS);
