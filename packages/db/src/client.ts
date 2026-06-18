/**
 * @zapdos/db — Prisma client singleton + re-exports.
 *
 * Use `db` everywhere instead of `new PrismaClient()` to avoid spawning a
 * connection pool per request (the classic Next.js dev-mode hot-reload trap).
 */

import { Prisma, PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  __zapdosPrisma?: PrismaClient;
};

export const db =
  globalForPrisma.__zapdosPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__zapdosPrisma = db;
}

// Re-export the generated client + types so consumers have one import path.
export { Prisma };
export * from '@prisma/client';
