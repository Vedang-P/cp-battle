/**
 * Wipe all user account data from the database.
 *
 * This script:
 * 1. Deletes all submissions, match progress, matches, feedback
 * 2. Deletes all OAuth accounts, sessions, verification tokens
 * 3. Deletes all users (except the bot)
 * 4. Resets bot user stats
 *
 * Usage:
 *   pnpm --env-file=../../.env tsx scripts/wipe-user-data.ts
 *
 * WARNING: This is destructive and irreversible!
 */

import { db } from '@zapdos/db';
import { BOT_EMAIL } from '../lib/bot-config';

function progress(msg: string): void {
  const ts = new Date().toISOString().split('T')[1]!.slice(0, 8);
  process.stdout.write(`[${ts}] ${msg}\n`);
}

async function wipeUserData() {
  progress('=== Wipe User Data ===');
  progress('WARNING: This is destructive and irreversible!');
  progress('');

  // Count before
  const userCount = await db.user.count();
  const matchCount = await db.match.count();
  const submissionCount = await db.submission.count();
  const progressCount = await db.matchProgress.count();
  const feedbackCount = await db.feedback.count();

  progress(`Before wipe:`);
  progress(`  Users: ${userCount}`);
  progress(`  Matches: ${matchCount}`);
  progress(`  Submissions: ${submissionCount}`);
  progress(`  MatchProgress: ${progressCount}`);
  progress(`  Feedback: ${feedbackCount}`);
  progress('');

  // Delete in order (respecting foreign keys)
  progress('Deleting submissions...');
  const deletedSubmissions = await db.submission.deleteMany();
  progress(`  Deleted ${deletedSubmissions.count} submissions`);

  progress('Deleting match progress...');
  const deletedProgress = await db.matchProgress.deleteMany();
  progress(`  Deleted ${deletedProgress.count} match progress rows`);

  progress('Deleting matches...');
  const deletedMatches = await db.match.deleteMany();
  progress(`  Deleted ${deletedMatches.count} matches`);

  progress('Deleting feedback...');
  const deletedFeedback = await db.feedback.deleteMany();
  progress(`  Deleted ${deletedFeedback.count} feedback entries`);

  progress('Deleting OAuth accounts...');
  const deletedAccounts = await db.account.deleteMany();
  progress(`  Deleted ${deletedAccounts.count} accounts`);

  progress('Deleting sessions...');
  const deletedSessions = await db.session.deleteMany();
  progress(`  Deleted ${deletedSessions.count} sessions`);

  progress('Deleting verification tokens...');
  const deletedTokens = await db.verificationToken.deleteMany();
  progress(`  Deleted ${deletedTokens.count} verification tokens`);

  // Delete all users except the bot
  progress('Deleting users (except bot)...');
  const deletedUsers = await db.user.deleteMany({
    where: { email: { not: BOT_EMAIL } },
  });
  progress(`  Deleted ${deletedUsers.count} users`);

  // Reset bot user stats
  progress('Resetting bot user stats...');
  await db.user.update({
    where: { email: BOT_EMAIL },
    data: {
      elo: 1200,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    },
  });
  progress('  Bot user stats reset');

  // Final count
  progress('');
  progress('=== After Wipe ===');
  const finalUserCount = await db.user.count();
  const finalMatchCount = await db.match.count();
  const finalSubmissionCount = await db.submission.count();
  progress(`  Users: ${finalUserCount} (bot preserved)`);
  progress(`  Matches: ${finalMatchCount}`);
  progress(`  Submissions: ${finalSubmissionCount}`);

  progress('');
  progress('=== Wipe Complete ===');
  progress('Note: Redis data (rate limits, queues, caches) was not cleared.');
  progress('To clear Redis: redis-cli FLUSHDB');

  await db.$disconnect();
  process.exit(0);
}

wipeUserData().catch((err) => {
  progress(`FATAL: ${err}`);
  process.exit(1);
});
