function optional(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    console.warn(`[env] Missing env var: ${name}, using empty string fallback`);
    return '';
  }
  return v;
}

export const env = {
  get appUrl() { return optional('APP_URL', 'http://localhost:3000'); },
  get databaseUrl() { return required('DATABASE_URL'); },
  get redisUrl() { return optional('REDIS_URL', 'redis://localhost:6379'); },
  get pistonUrl() { return optional('PISTON_URL', 'http://localhost:2000'); },
  get authSecret() { return optional('AUTH_SECRET', optional('NEXTAUTH_SECRET', 'dev-secret-change-me')); },
  get nextauthUrl() { return optional('NEXTAUTH_URL', 'http://localhost:3000'); },
  get realtimeCorsOrigin() { return optional('REALTIME_CORS_ORIGIN', 'http://localhost:3000'); },
  get judgeConcurrency() { return Number(process.env.JUDGE_CONCURRENCY ?? 4); },
};
