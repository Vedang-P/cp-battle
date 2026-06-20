/**
 * Shared Redis client (singleton).
 *
 * One connection per process, reused by matchmaking queue, BullMQ workers,
 * and the Socket.IO redis adapter (when we scale). Hot-reload-safe like the
 * Prisma singleton.
 */

import Redis from 'ioredis';
import { env } from './env';

const globalForRedis = globalThis as unknown as { __zapdosRedis?: Redis };

function createRedis(): Redis {
  const client = new Redis(env.redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });
  client.on('error', (err: Error) => {
    console.error('[redis] Connection error:', err.message);
  });
  return client;
}

export const redis: Redis =
  globalForRedis.__zapdosRedis ?? createRedis();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.__zapdosRedis = redis;
}
