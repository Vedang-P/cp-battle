/**
 * Server-side session helper. `requireUser` throws on no-session so route
 * handlers read like guarded code; `getUser` returns null for soft checks.
 */

import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

export async function getUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

export async function requireUser(): Promise<{ id: string; username: string }> {
  const u = await getUser();
  if (!u) throw new Error('UNAUTHORIZED');
  return u;
}
