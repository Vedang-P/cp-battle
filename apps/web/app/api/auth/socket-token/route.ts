import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { mintSocketToken } from '@/lib/socket-token';

export const dynamic = 'force-dynamic';

/** Returns a short-lived JWT the browser uses to auth the Socket.IO handshake. */
export async function GET() {
  try {
    const user = await requireUser();
    const token = mintSocketToken(user.id, user.username);
    return NextResponse.json({ token });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
