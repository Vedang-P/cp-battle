/**
 * Match finalization worker — checks for expired matches and finalizes them.
 *
 * Runs as a separate process (`pnpm dev:finalizer`). Polls for IN_PROGRESS
 * matches past their endsAt timestamp and calls finalizeMatch().
 * Emits match:end via the realtime bridge so both players are notified.
 */

import { db } from '@zapdos/db';
import { finalizeMatch } from '@zapdos/match';
import { emitToMatch } from '../lib/socket';
import type { MatchEndPayload } from '@zapdos/realtime';

const POLL_INTERVAL_MS = 5000;

async function poll() {
  try {
    const expiredMatches = await db.match.findMany({
      where: {
        status: 'IN_PROGRESS',
        endsAt: { lt: new Date() },
      },
      take: 10,
    });

    for (const match of expiredMatches) {
      console.log(`[finalizer] Finalizing expired match ${match.id}`);
      try {
        const result = await finalizeMatch({ matchId: match.id, reason: 'time' });
        console.log(`[finalizer] Match ${match.id} finalized — winner: ${result.winnerId ?? 'draw'}`);

        // Emit match:end to both players via the realtime bridge
        const endPayload: MatchEndPayload = {
          matchId: match.id,
          status: 'COMPLETED',
          winnerId: result.winnerId,
          scoreA: result.scoreA,
          scoreB: result.scoreB,
          eloDeltaA: result.eloDeltaA,
          eloDeltaB: result.eloDeltaB,
          reason: 'time',
        };
        await emitToMatch(match.id, 'match:end', endPayload);
      } catch (err) {
        console.error(`[finalizer] Failed to finalize ${match.id}:`, err);
      }
    }
  } catch (err) {
    console.error('[finalizer] Error:', err);
  }
}

// Recursive setTimeout — prevents overlapping polls
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
  console.log(`[finalizer] Received ${signal}, shutting down...`);
  shuttingDown = true;
  if (pollTimer) clearTimeout(pollTimer);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => console.error('[finalizer] Unhandled rejection:', err));
process.on('uncaughtException', (err) => console.error('[finalizer] Uncaught exception:', err));

console.log('[finalizer] Starting match finalization worker...');
scheduleNextPoll();
