/**
 * Shared validation schemas (zod). Reused by API routes and client forms so
 * the rules can never drift between them.
 */

import { z } from 'zod';

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const PASSWORD_MIN = 8;

export const signinSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export const signupSchema = z
  .object({
    username: z
      .string()
      .min(3, 'At least 3 characters')
      .max(20, 'At most 20 characters')
      .regex(USERNAME_RE, 'Letters, numbers, underscores only'),
    email: z.string().email('Enter a valid email'),
    password: z.string().min(PASSWORD_MIN, `At least ${PASSWORD_MIN} characters`),
  })
  .strict();

/** Public-safe user shape returned by auth + profile endpoints. */
export interface PublicUser {
  id: string;
  username: string;
  email: string;
  elo: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}
