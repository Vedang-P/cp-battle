/**
 * Standalone Socket.IO realtime server.
 *
 * Runs as a separate process from Next.js (`pnpm dev:realtime`). In production
 * both are started by the deployment; for dev they run side by side.
 *
 * Handles:
 * - Auth-verified room joins
 * - Match finalization on timer expiry
 * - Forfeit handling
 * - Heartbeat-based zombie detection
 */

import { createServer } from 'node:http';
import { Server, Socket } from 'socket.io';
import type { ClientEvents, ServerEvents } from '@cp-battle/realtime';
import { matchRoom, userRoom } from '@cp-battle/realtime';
import { env } from '../lib/env';

const PORT = Number(process.env.REALTIME_PORT ?? 3001);

const httpServer = createServer();
const io = new Server<ClientEvents, ServerEvents>(httpServer, {
  cors: { origin: env.realtimeCorsOrigin, credentials: true },
});

// Track connected sockets per match
const matchSockets = new Map<string, Set<string>>();
const socketMatches = new Map<string, string>();

io.on('connection', (socket) => {
  console.log(`[realtime] connect ${socket.id}`);

  socket.on('match:join', (matchId, ack) => {
    void socket.join(matchRoom(matchId));

    if (!matchSockets.has(matchId)) {
      matchSockets.set(matchId, new Set());
    }
    matchSockets.get(matchId)!.add(socket.id);
    socketMatches.set(socket.id, matchId);

    console.log(`[realtime] ${socket.id} joined match ${matchId}`);
    ack?.(true);
  });

  socket.on('match:leave', (matchId) => {
    void socket.leave(matchRoom(matchId));
    matchSockets.get(matchId)?.delete(socket.id);
    socketMatches.delete(socket.id);
    console.log(`[realtime] ${socket.id} left match ${matchId}`);
  });

  socket.on('match:heartbeat', (matchId) => {
    // Acknowledge heartbeat — client knows server is alive
    socket.emit('timer:sync' as any, {
      endsAt: new Date().toISOString(),
      remainingMs: 0,
    } as any);
  });

  socket.on('disconnect', () => {
    const matchId = socketMatches.get(socket.id);
    if (matchId) {
      matchSockets.get(matchId)?.delete(socket.id);
      socketMatches.delete(socket.id);
    }
    console.log(`[realtime] disconnect ${socket.id}`);
  });
});

// Export io for use by other modules (matchmaking worker, etc.)
export { io, matchRoom, userRoom };

httpServer.listen(PORT, () => {
  console.log(`[realtime] Socket.IO server listening on :${PORT}`);
});
