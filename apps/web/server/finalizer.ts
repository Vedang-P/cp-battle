/**
 * Match finalization worker — checks for expired matches and finalizes them.
 *
 * Runs as a separate process (`pnpm dev:finalizer`). Polls for IN_PROGRESS
 * matches past their endsAt timestamp and calls finalizeMatch().
 * Emits match:end via the realtime bridge so both players are notified.
 */

import { db } from '@cp-battle/db';
import { finalizeMatch } from '@cp-battle/match';
import { emitToMatch } from '../lib/socket';
import type { MatchEndPayload } from '@cp-battle/realtime';

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

console.log('[finalizer] Starting match finalization worker...');
setInterval(poll, POLL_INTERVAL_MS);
