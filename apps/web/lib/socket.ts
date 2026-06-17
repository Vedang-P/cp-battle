/**
 * Helper to emit Socket.IO events from Next.js API routes.
 *
 * The Socket.IO server runs as a separate process on port 3002.
 * This helper sends HTTP POST requests to the /emit endpoint,
 * which then broadcasts to the appropriate Socket.IO room.
 */

const REALTIME_URL = process.env.REALTIME_URL ?? 'http://localhost:3002';

export async function emitSocketEvent(
  room: string,
  event: string,
  payload: unknown,
): Promise<boolean> {
  try {
    const res = await fetch(`${REALTIME_URL}/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room, event, payload }),
    });
    return res.ok;
  } catch (err) {
    console.error(`[socket-emit] Failed to emit ${event} to ${room}:`, err);
    return false;
  }
}

import { matchRoom } from '@cp-battle/realtime';

/** Emit an event to a match room. */
export function emitToMatch(matchId: string, event: string, payload: unknown) {
  return emitSocketEvent(matchRoom(matchId), event, payload);
}

/** Emit an event to a specific user's room. */
export function emitToUser(userId: string, event: string, payload: unknown) {
  return emitSocketEvent(`user:${userId}`, event, payload);
}
