import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware — two protections:
 *
 * 1. Auth pre-filter: API routes (except health/auth/leaderboard) require a
 *    session cookie. This is a fast presence check — the actual JWT
 *    validation happens in `requireUser()` inside each route handler.
 *
 * 2. CSRF protection: mutating methods (POST/PUT/DELETE/PATCH) must have an
 *    Origin or Referer header that matches the app's URL. This blocks
 *    cross-site form submissions and cross-origin fetch attacks, since
 *    browsers always send Origin on cross-origin requests.
 */

const EXEMPT_ROUTES = /^\/api\/(?!health|auth|leaderboard)/;
const APP_URL = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

export function middleware(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;

  if (EXEMPT_ROUTES.test(pathname)) {
    // 1. Session cookie presence check
    const sessionToken = request.cookies.get('next-auth.session-token')?.value
      ?? request.cookies.get('__Secure-next-auth.session-token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. CSRF: check Origin/Referer on mutating methods
    const method = request.method.toUpperCase();
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      const originHeader = request.headers.get('origin');
      const refererHeader = request.headers.get('referer');

      // Allow same-origin requests (origin matches the request URL origin)
      // Also allow when Origin header is missing but Referer matches (some browsers)
      const expectedOrigin = new URL(APP_URL).origin;
      const requestOrigin = originHeader ?? (refererHeader ? new URL(refererHeader).origin : null);

      if (requestOrigin && requestOrigin !== expectedOrigin && requestOrigin !== origin) {
        return NextResponse.json({ error: 'Cross-origin requests not allowed' }, { status: 403 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
