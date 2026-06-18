/**
 * Mint a short-lived HMAC-SHA256 JWT for the realtime Socket.IO server.
 *
 * NextAuth's session cookie is httpOnly, so the browser cannot read it to pass
 * to the Socket.IO handshake. This mints a fresh, short-lived token signed
 * with the same AUTH_SECRET the realtime server verifies against.
 *
 * Format mirrors a JWS: base64url(header).base64url(payload).base64url(sig)
 * where sig = HMAC-SHA256(header.payload, AUTH_SECRET).
 */

import { createHmac } from 'node:crypto';
import { env } from '@/lib/env';

const TOKEN_TTL_SEC = 60 * 60; // 1 hour — long enough for a match, short enough to limit theft

function b64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64url');
}

export function mintSocketToken(userId: string, username: string): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    JSON.stringify({
      sub: userId,
      name: username,
      iat: now,
      exp: now + TOKEN_TTL_SEC,
    }),
  );
  const sig = createHmac('sha256', env.authSecret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}
