/**
 * PM2 ecosystem config — starts all Zapdos processes in production.
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 save
 *   pm2 startup
 *
 * Processes:
 *   - web:        Next.js on :3000
 *   - realtime:   Socket.IO on :3002
 *   - matchmaker: Matchmaking worker
 *   - finalizer:  Match finalization worker
 *   - bot:        Practice bot worker
 */

module.exports = {
  apps: [
    {
      name: 'zapdos-web',
      script: 'node',
      args: 'apps/web/server.js',
      env: { NODE_ENV: 'production', PORT: 3000 },
      max_memory_restart: '512M',
      instances: 1,
      autorestart: true,
    },
    {
      name: 'zapdos-realtime',
      script: 'node_modules/.bin/tsx',
      args: 'apps/web/server/index.ts',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '256M',
      instances: 1,
      autorestart: true,
    },
    {
      name: 'zapdos-matchmaker',
      script: 'node_modules/.bin/tsx',
      args: 'apps/web/server/matchmaker.ts',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '256M',
      instances: 1,
      autorestart: true,
    },
    {
      name: 'zapdos-finalizer',
      script: 'node_modules/.bin/tsx',
      args: 'apps/web/server/finalizer.ts',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '256M',
      instances: 1,
      autorestart: true,
    },
    {
      name: 'zapdos-bot',
      script: 'node_modules/.bin/tsx',
      args: 'apps/web/server/bot-worker.ts',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '256M',
      instances: 1,
      autorestart: true,
    },
  ],
};
