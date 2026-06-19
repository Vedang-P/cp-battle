/**
 * Delete all CSES problems from the database.
 *
 * Handles FK constraints by deleting dependent rows first:
 * 1. Submissions referencing CSES problem IDs
 * 2. MatchProgress referencing CSES problem IDs
 * 3. CSES Problem rows (cascades to TestCase via onDelete: Cascade)
 *
 * Usage:
 *   pnpm --env-file=../../.env tsx scripts/delete-cses-problems.ts
 */

import { db } from '@zapdos/db';

function progress(msg: string): void {
  const ts = new Date().toISOString().split('T')[1]!.slice(0, 8);
  process.stdout.write(`[${ts}] ${msg}\n`);
}

async function deleteCSESProblems() {
  progress('=== Delete CSES Problems ===');

  // Find all CSES problem IDs
  const csesProblems = await db.problem.findMany({
    where: { slug: { startsWith: 'cses-' } },
    select: { id: true, slug: true },
  });

  const csesIds = csesProblems.map((p) => p.id);
  progress(`Found ${csesIds.length} CSES problems`);

  if (csesIds.length === 0) {
    progress('No CSES problems to delete. Done.');
    await db.$disconnect();
    return;
  }

  // Count dependent rows
  const submissionCount = await db.submission.count({
    where: { problemId: { in: csesIds } },
  });
  const matchProgressCount = await db.matchProgress.count({
    where: { problemId: { in: csesIds } },
  });
  progress(`Found ${submissionCount} submissions referencing CSES problems`);
  progress(`Found ${matchProgressCount} match progress rows referencing CSES problems`);

  // Delete in FK-safe order
  progress('Deleting submissions...');
  const deletedSubmissions = await db.submission.deleteMany({
    where: { problemId: { in: csesIds } },
  });
  progress(`  Deleted ${deletedSubmissions.count} submissions`);

  progress('Deleting match progress...');
  const deletedProgress = await db.matchProgress.deleteMany({
    where: { problemId: { in: csesIds } },
  });
  progress(`  Deleted ${deletedProgress.count} match progress rows`);

  progress('Deleting CSES problems (cascades to test cases)...');
  const deletedProblems = await db.problem.deleteMany({
    where: { slug: { startsWith: 'cses-' } },
  });
  progress(`  Deleted ${deletedProblems.count} problems`);

  // Verify
  progress('');
  progress('=== Verification ===');
  const remaining = await db.problem.count();
  const remainingCSES = await db.problem.count({ where: { slug: { startsWith: 'cses-' } } });
  const testCaseCount = await db.testCase.count();
  progress(`  Remaining problems: ${remaining}`);
  progress(`  CSES problems remaining: ${remainingCSES}`);
  progress(`  Remaining test cases: ${testCaseCount}`);

  // Show difficulty breakdown
  const breakdown = await db.problem.groupBy({
    by: ['difficulty'],
    _count: { id: true },
    where: { isVisible: true },
  });
  progress('  Difficulty breakdown (visible):');
  for (const row of breakdown) {
    progress(`    ${row.difficulty}: ${row._count.id}`);
  }

  progress('');
  progress('=== Done ===');

  await db.$disconnect();
  process.exit(0);
}

deleteCSESProblems().catch((err) => {
  progress(`FATAL: ${err}`);
  process.exit(1);
});
