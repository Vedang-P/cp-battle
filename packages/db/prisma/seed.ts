/**
 * Zapdos — Problem seed script
 *
 * This seed no longer creates hand-authored problems.
 * All problems come from the CSES scraper.
 *
 * Run: pnpm --filter web scrape-problems -- --cses
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

  console.log('[seed] No problems found. Run the CSES scraper to populate:');
  console.log('[seed]   pnpm --filter web scrape-problems -- --cses');
}

main()
  .catch((e) => {
    console.error('[seed] failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
