/**
 * Centralised env access for the web app.
 *
 * Validates that required vars are present at module load so a misconfigured
 * boot fails loudly with a clear message instead of a cryptic 500 later.
 * Client-bundled code must NOT import this (it references server-only secrets).
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required env var: ${name}. Copy .env.example to .env and fill it in.`);
  }
  return v;
}

export const env = {
  appUrl: required('APP_URL'),
  databaseUrl: required('DATABASE_URL'),
  redisUrl: required('REDIS_URL'),
  pistonUrl: process.env.PISTON_URL ?? 'http://localhost:2000',
  authSecret: required('AUTH_SECRET'),
  nextauthUrl: required('NEXTAUTH_URL'),
  realtimeCorsOrigin: process.env.REALTIME_CORS_ORIGIN ?? 'http://localhost:3000',
  judgeConcurrency: Number(process.env.JUDGE_CONCURRENCY ?? 4),
};
