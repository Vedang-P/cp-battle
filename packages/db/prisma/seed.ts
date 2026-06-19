/**
 * Zapdos — Problem seed script
 *
 * All problems come from the Codeforces importer.
 *
 * Run: pnpm --filter web import-codeforces
 *
 * The seed is kept as a no-op so `pnpm db:seed` doesn't fail.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.problem.count();
  if (count > 0) {
    console.log(`[seed] ${count} problems already exist — skipping.`);
    return;
  }

  console.log('[seed] No problems found. Run the Codeforces importer to populate:');
  console.log('[seed]   pnpm --filter web import-codeforces');
}

main()
  .catch((e) => {
    console.error('[seed] failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
