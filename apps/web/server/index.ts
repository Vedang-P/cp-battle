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
import type { ClientEvents, ServerEvents } from '@cp-battle/realtime';
import { matchRoom, userRoom } from '@cp-battle/realtime';
import { db } from '@cp-battle/db';

const PORT = Number(process.env.REALTIME_PORT ?? 3002);
const AUTH_SECRET = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? '';

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

// Track connected sockets per match
const matchSockets = new Map<string, Set<string>>();
const socketMatches = new Map<string, string>();

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

  socket.on('match:forfeit', (matchId) => {
    // Forward the forfeit to the match API via HTTP POST
    fetch(`http://localhost:3000/api/match/${matchId}/forfeit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: socket.userId }),
    }).catch(() => {});
    console.log(`[realtime] ${socket.id} forfeited match ${matchId}`);
  });

  socket.on('match:heartbeat', (matchId) => {
    db.match.findUnique({ where: { id: matchId }, select: { endsAt: true } })
      .then((match) => {
        const endsAt = match?.endsAt ?? new Date();
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
