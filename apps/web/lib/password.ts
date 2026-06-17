/**
 * Password hashing helpers.
 *
 * bcryptjs (pure JS) so it runs in any Node env without native build tools.
 * Cost factor 12 is a reasonable 2024 default for interactive logins.
 */

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
