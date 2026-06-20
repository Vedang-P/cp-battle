/**
 * Standalone Socket.IO realtime server.
 *
 * Runs as a separate process from Next.js (`pnpm dev:realtime`). In production
 * both are started by the deployment; for dev they run side by side.
 *
 * Handles:
 * - Auth-verified room joins
 * - Timer sync via heartbeat
 * - HTTP bridge for other processes to emit events (POST /emit)
 * - Disconnect cleanup
 */

import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { ClientEvents, ServerEvents } from '@zapdos/realtime';
import { matchRoom, userRoom } from '@zapdos/realtime';
import { db } from '@zapdos/db';

const PORT = Number(process.env.REALTIME_PORT ?? 3002);
const AUTH_SECRET = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? '';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

const httpServer = createServer((req, res) => {
  // Health check
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // HTTP bridge: other processes POST events here to be emitted via Socket.IO.
  // HMAC-signed with AUTH_SECRET to prevent forgery.
  if (req.url === '/emit' && req.method === 'POST') {
    let body = '';
    let bodySize = 0;
    const MAX_BODY = 1_000_000; // 1MB cap
    req.on('data', (chunk) => {
      bodySize += chunk.length;
      if (bodySize > MAX_BODY) {
        req.destroy();
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Body too large' }));
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      try {
        // Verify HMAC signature
        const sig = req.headers['x-internal-signature'] as string | undefined;
        if (!AUTH_SECRET || !sig) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing signature' }));
          return;
        }
        const expectedSig = createHmac('sha256', AUTH_SECRET).update(body).digest('hex');
        const sigBuf = Buffer.from(sig);
        const expectedBuf = Buffer.from(expectedSig);
        if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid signature' }));
          return;
        }

        const { room, event, payload } = JSON.parse(body) as {
          room: string;
          event: string;
          payload: unknown;
        };
        if (!room || !event) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing room or event' }));
          return;
        }
        io.to(room).emit(event as any, payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

const io: InstanceType<typeof Server<ClientEvents, ServerEvents>> = new Server<ClientEvents, ServerEvents>(httpServer, {
  cors: { origin: process.env.REALTIME_CORS_ORIGIN ?? 'http://localhost:3000', credentials: true },
  maxHttpBufferSize: 1e6,
  connectTimeout: 10000,
});

// Redis adapter — enables horizontal scaling: multiple realtime instances
// share rooms and can emit to sockets connected to any instance.
const pubClient = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));

// Track connected sockets per match
const matchSockets = new Map<string, Set<string>>();
const socketMatches = new Map<string, string>();

// Disconnect → auto-forfeit. When a player's LAST socket for a match drops, we
// start a grace timer; if they don't reconnect within it, the opponent wins by
// forfeit instead of waiting out the full match clock.
const socketUser = new Map<string, string>(); // socketId -> userId
const forfeitTimers = new Map<string, NodeJS.Timeout>(); // `${matchId}:${userId}` -> timer
const DISCONNECT_FORFEIT_GRACE_MS = Number(process.env.DISCONNECT_FORFEIT_GRACE_MS ?? 30_000);

function userHasSocketInMatch(matchId: string, userId: string): boolean {
  const sockets = matchSockets.get(matchId);
  if (!sockets) return false;
  for (const sid of sockets) {
    if (socketUser.get(sid) === userId) return true;
  }
  return false;
}

function cancelForfeit(matchId: string, userId: string): void {
  const key = `${matchId}:${userId}`;
  const timer = forfeitTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    forfeitTimers.delete(key);
  }
}

function scheduleForfeit(matchId: string, userId: string): void {
  const key = `${matchId}:${userId}`;
  if (forfeitTimers.has(key)) return; // already pending
  const timer = setTimeout(async () => {
    forfeitTimers.delete(key);
    try {
      // Reconnected during the grace window? Then don't forfeit.
      if (userHasSocketInMatch(matchId, userId)) return;
      const match = await db.match.findUnique({
        where: { id: matchId },
        select: { status: true, playerAId: true, playerBId: true },
      });
      // No-op if the match already ended (finalizeMatch is idempotent anyway).
      if (!match || match.status !== 'IN_PROGRESS') return;
      if (match.playerAId !== userId && match.playerBId !== userId) return;

      const { finalizeMatch } = await import('@zapdos/match');
      const { emitSocketEvent } = await import('../lib/socket');
      await finalizeMatch({ matchId, reason: 'disconnect', forfeiterId: userId });

      const matchData = await db.match.findUnique({ where: { id: matchId } });
      if (matchData) {
        await emitSocketEvent(matchRoom(matchId), 'match:end', {
          matchId,
          status: 'COMPLETED',
          winnerId: matchData.winnerId,
          scoreA: matchData.scoreA,
          scoreB: matchData.scoreB,
          eloDeltaA: matchData.eloDeltaA,
          eloDeltaB: matchData.eloDeltaB,
          reason: 'disconnect',
        });
      }
      console.log(`[realtime] auto-forfeit: ${userId} disconnected from ${matchId}`);
    } catch (err) {
      console.error(`[realtime] auto-forfeit failed for ${matchId}/${userId}:`, err);
    }
  }, DISCONNECT_FORFEIT_GRACE_MS);
  forfeitTimers.set(key, timer);
}

/** Verify a NextAuth-style JWT (HMAC-SHA256) using only Node crypto. */
function verifyJwt(token: string, secret: string): { userId: string; username?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts as [string, string, string];
    const expectedSig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data.sub || typeof data.sub !== 'string') return null;
    // Reject expired tokens (exp is in seconds since epoch)
    if (typeof data.exp === 'number' && data.exp * 1000 < Date.now()) return null;
    return { userId: data.sub, username: data.name };
  } catch {
    return null;
  }
}

// Auth middleware — verify JWT from handshake
io.use((socket: AuthenticatedSocket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token || typeof token !== 'string') {
    return next(new Error('Authentication required'));
  }
  if (!AUTH_SECRET) {
    return next(new Error('Server misconfigured'));
  }
  const decoded = verifyJwt(token, AUTH_SECRET);
  if (!decoded) {
    return next(new Error('Invalid token'));
  }
  socket.userId = decoded.userId;
  socket.username = decoded.username ?? '';
  next();
});

io.on('connection', (socket: AuthenticatedSocket) => {
  console.log(`[realtime] connect ${socket.id} user=${socket.userId}`);

  // Join the user's personal room so emitToUser() events reach them
  if (socket.userId) {
    void socket.join(userRoom(socket.userId));
    socketUser.set(socket.id, socket.userId);
  }

  socket.on('match:join', (matchId, ack) => {
    // Verify the user is a participant in this match
    db.match.findUnique({ where: { id: matchId }, select: { playerAId: true, playerBId: true } })
      .then((match) => {
        if (!match) { ack?.(false); return; }
        if (match.playerAId !== socket.userId && match.playerBId !== socket.userId) {
          ack?.(false); return;
        }
        void socket.join(matchRoom(matchId));
        if (!matchSockets.has(matchId)) matchSockets.set(matchId, new Set());
        matchSockets.get(matchId)!.add(socket.id);
        socketMatches.set(socket.id, matchId);
        if (socket.userId) {
          socketUser.set(socket.id, socket.userId);
          cancelForfeit(matchId, socket.userId); // (re)connected → cancel any pending forfeit
        }
        console.log(`[realtime] ${socket.id} joined match ${matchId}`);
        ack?.(true);
      })
      .catch(() => ack?.(false));
  });

  socket.on('match:leave', (matchId) => {
    void socket.leave(matchRoom(matchId));
    matchSockets.get(matchId)?.delete(socket.id);
    socketMatches.delete(socket.id);
    console.log(`[realtime] ${socket.id} left match ${matchId}`);
  });

  socket.on('match:forfeit', async (matchId) => {
    try {
      // Verify the user is a participant in this match
      const match = await db.match.findUnique({
        where: { id: matchId },
        select: { playerAId: true, playerBId: true, status: true },
      });
      if (!match || match.status !== 'IN_PROGRESS') return;
      if (match.playerAId !== socket.userId && match.playerBId !== socket.userId) return;

      // Determine the winner (the opponent of the forfeiter)
      const opponentId = socket.userId === match.playerAId ? match.playerBId : match.playerAId;

      // Import and call finalizeMatch directly (no HTTP request needed)
      const { finalizeMatch } = await import('@zapdos/match');
      const { emitSocketEvent } = await import('../lib/socket');
      const { matchRoom } = await import('@zapdos/realtime');

      const result = await finalizeMatch({ matchId, reason: 'forfeit', forfeiterId: socket.userId });

      // Emit match:end to both players
      const matchData = await db.match.findUnique({ where: { id: matchId } });
      if (matchData) {
        const endPayload = {
          matchId,
          status: 'COMPLETED',
          winnerId: matchData.winnerId,
          scoreA: matchData.scoreA,
          scoreB: matchData.scoreB,
          eloDeltaA: matchData.eloDeltaA,
          eloDeltaB: matchData.eloDeltaB,
          reason: 'forfeit',
        };
        await emitSocketEvent(matchRoom(matchId), 'match:end', endPayload);
      }

      console.log(`[realtime] ${socket.id} forfeited match ${matchId}`);
    } catch (err) {
      console.error(`[realtime] forfeit failed for match ${matchId}:`, err);
    }
  });

  socket.on('match:heartbeat', (matchId) => {
    db.match.findUnique({
      where: { id: matchId },
      select: { endsAt: true, playerAId: true, playerBId: true },
    })
      .then((match) => {
        if (!match) return;
        // Only respond if the socket user is a participant
        if (match.playerAId !== socket.userId && match.playerBId !== socket.userId) return;
        const endsAt = match.endsAt ?? new Date();
        const remainingMs = Math.max(0, endsAt.getTime() - Date.now());
        socket.emit('timer:sync', {
          endsAt: endsAt.toISOString(),
          remainingMs,
        });
      })
      .catch(() => {});
  });

  socket.on('disconnect', () => {
    const matchId = socketMatches.get(socket.id);
    const userId = socket.userId;
    if (matchId) {
      matchSockets.get(matchId)?.delete(socket.id);
      socketMatches.delete(socket.id);
      // If this was the user's last socket in the match, start the grace timer.
      if (userId && !userHasSocketInMatch(matchId, userId)) {
        scheduleForfeit(matchId, userId);
      }
    }
    socketUser.delete(socket.id);
    console.log(`[realtime] disconnect ${socket.id}`);
  });
});

// Export io for use by other modules (matchmaking worker, etc.)
export { io, matchRoom, userRoom };

httpServer.listen(PORT, () => {
  console.log(`[realtime] Socket.IO server listening on :${PORT}`);
});

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`[realtime] Received ${signal}, shutting down...`);
  io.close(() => {
    pubClient.disconnect();
    subClient.disconnect();
    httpServer.close(() => process.exit(0));
  });
  // Force exit after 5s if graceful close hangs
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => console.error('[realtime] Unhandled rejection:', err));
process.on('uncaughtException', (err) => console.error('[realtime] Uncaught exception:', err));
