/**
 * Helper to emit Socket.IO events from Next.js API routes and worker processes.
 *
 * The Socket.IO server runs as a separate process on port 3002.
 * This helper sends authenticated HTTP POST requests to the /emit endpoint,
 * which then broadcasts to the appropriate Socket.IO room.
 *
 * Security: every /emit request is HMAC-signed with AUTH_SECRET so that
 * external attackers can't forge events even if they can reach port 3002.
 */

import { createHmac } from 'node:crypto';

const REALTIME_URL = process.env.REALTIME_URL ?? 'http://localhost:3002';
const AUTH_SECRET = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? '';

export async function emitSocketEvent(
  room: string,
  event: string,
  payload: unknown,
): Promise<boolean> {
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
    console.error(`[socket-emit] Failed to emit ${event} to ${room}:`, err);
    return false;
  }
}

import { matchRoom } from '@zapdos/realtime';

/** Emit an event to a match room. */
export function emitToMatch(matchId: string, event: string, payload: unknown) {
  return emitSocketEvent(matchRoom(matchId), event, payload);
}

/** Emit an event to a specific user's room. */
export function emitToUser(userId: string, event: string, payload: unknown) {
  return emitSocketEvent(`user:${userId}`, event, payload);
}
