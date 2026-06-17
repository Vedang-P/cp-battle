import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const API_ROUTE = /^\/api\/(?!health|auth)/;

export function middleware(request: NextRequest) {
  // Protect API routes (except /api/health and /api/auth)
  if (API_ROUTE.test(request.nextUrl.pathname)) {
    const sessionToken = request.cookies.get('next-auth.session-token')?.value
      ?? request.cookies.get('__Secure-next-auth.session-token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
