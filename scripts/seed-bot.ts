/**
 * Seed the CP-Bot user for practice mode.
 * Run: pnpm tsx scripts/seed-bot.ts
 */

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

const BOT_EMAIL = 'cp-bot@cp-battle.dev';
const BOT_USERNAME = 'CP-Bot';
// Random password — nobody logs in as the bot
const BOT_PASSWORD = createHash('sha256').update('cp-bot-' + Date.now()).digest('hex');

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: BOT_EMAIL } });
  if (existing) {
    console.log(`Bot user already exists: ${existing.id} (${existing.username})`);
    return;
  }

  const bot = await prisma.user.create({
    data: {
      email: BOT_EMAIL,
      username: BOT_USERNAME,
      passwordHash: BOT_PASSWORD,
      elo: 1200,
    },
  });

  console.log(`Created bot user: ${bot.id} (${bot.username})`);
  console.log(`BOT_USER_ID="${bot.id}"`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
