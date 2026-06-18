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

export const redis: Redis =
  globalForRedis.__zapdosRedis ??
  new Redis(env.redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.__zapdosRedis = redis;
}
