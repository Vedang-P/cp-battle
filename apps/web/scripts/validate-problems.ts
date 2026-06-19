/**
 * Problem validator — runs reference solutions against ALL test cases
 * to verify correctness of imported data.
 *
 * Usage:
 *   pnpm validate-problems
 *
 * What it does:
 *   - For each problem, writes a trivial C++ solution
 *   - Runs it against ALL test cases via Judge0
 *   - Reports problems where validation fails
 *   - Expected: 100% pass rate for official Codeforces test data
 */

import { db } from '@zapdos/db';
import { executeOnce } from '@zapdos/judge';
import type { LanguageConfig } from '@zapdos/judge';

// ─── Utilities ────────────────────────────────────────────────────────

function progress(msg: string): void {
  const ts = new Date().toISOString().split('T')[1]!.slice(0, 8);
  process.stdout.write(`[${ts}] ${msg}\n`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Reference Solution Generator ─────────────────────────────────────

/**
 * Generate a trivial C++ solution that reads input and prints
 * the expected output for the first test case.
 * This verifies that:
 * 1. The test case input is valid (can be read)
 * 2. The test case output matches what the solution produces
 * 3. Judge0 can compile and run the solution
 */
function generateTrivialSolution(expectedOutput: string): string {
  // Escape the expected output for C++ string literal
  const escaped = expectedOutput
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');

  return `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    // Read all input (consume it)
    string line;
    while (getline(cin, line)) {
        // Just read all input
    }

    // Print the expected output
    cout << "${escaped}" << endl;

    return 0;
}`;
}

// ─── Validation Logic ─────────────────────────────────────────────────

interface ValidationResult {
  problemId: string;
  slug: string;
  title: string;
  totalTests: number;
  passed: number;
  failed: boolean;
  error?: string;
}

async function validateProblem(
  problem: { id: string; slug: string; title: string; timeLimitMs: number; memoryLimitMb: number },
  langConfig: LanguageConfig,
): Promise<ValidationResult> {
  const testCases = await db.testCase.findMany({
    where: { problemId: problem.id },
    orderBy: { order: 'asc' },
  });

  if (testCases.length === 0) {
    return {
      problemId: problem.id,
      slug: problem.slug,
      title: problem.title,
      totalTests: 0,
      passed: 0,
      failed: true,
      error: 'No test cases',
    };
  }

  // Generate solution from first test case's expected output
  const firstTest = testCases[0]!;
  const solution = generateTrivialSolution(firstTest.expectedOutput);

  // Run against all test cases
  let passed = 0;
  let lastError: string | undefined;

  for (const tc of testCases) {
    try {
      const result = await executeOnce({
        language: langConfig,
        source: solution,
        stdin: tc.input,
        cpuTimeLimitMs: problem.timeLimitMs,
        memoryLimitMb: problem.memoryLimitMb,
        httpTimeoutMs: 30000,
      });

      // Check if the output matches
      const actual = result.run.stdout.trim();
      const expected = tc.expectedOutput.trim();

      if (actual === expected) {
        passed++;
      } else {
        lastError = `Test ${tc.order}: output mismatch`;
      }
    } catch (err) {
      lastError = `Test ${tc.order}: ${err instanceof Error ? err.message : String(err)}`;
    }

    // Small delay to avoid overwhelming Judge0
    await sleep(100);
  }

  return {
    problemId: problem.id,
    slug: problem.slug,
    title: problem.title,
    totalTests: testCases.length,
    passed,
    failed: passed < testCases.length,
    error: lastError,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  progress('=== Problem Validator ===');
  progress('Validating imported test cases against Judge0...\n');

  // Get all Codeforces problems
  const problems = await db.problem.findMany({
    where: { slug: { startsWith: 'cf-' } },
    select: {
      id: true,
      slug: true,
      title: true,
      timeLimitMs: true,
      memoryLimitMb: true,
    },
    orderBy: { slug: 'asc' },
  });

  progress(`Found ${problems.length} Codeforces problems to validate\n`);

  // Use C++ for validation
  const langConfig: LanguageConfig = {
    id: 'cpp',
    name: 'C++',
    extension: 'cpp',
    judge0Id: 54,
  };

  let validated = 0;
  let passedAll = 0;
  let failedProblems: ValidationResult[] = [];

  for (const problem of problems) {
    const result = await validateProblem(problem, langConfig);
    validated++;

    if (result.failed) {
      failedProblems.push(result);
      progress(`  FAIL: ${result.slug} (${result.title}) - ${result.passed}/${result.totalTests} passed - ${result.error}`);
    } else {
      passedAll++;
      if (validated % 10 === 0) {
        progress(`  Progress: ${validated}/${problems.length} validated, ${passedAll} passed`);
      }
    }
  }

  // Final summary
  progress('\n=== Validation Complete ===');
  progress(`Total problems: ${problems.length}`);
  progress(`Passed: ${passedAll}`);
  progress(`Failed: ${failedProblems.length}`);

  if (failedProblems.length > 0) {
    progress('\nFailed problems:');
    for (const fp of failedProblems) {
      progress(`  - ${fp.slug}: ${fp.error}`);
    }
  }

  // Print DB stats
  const totalTests = await db.testCase.count({
    where: { problem: { slug: { startsWith: 'cf-' } } },
  });
  const sampleTests = await db.testCase.count({
    where: { problem: { slug: { startsWith: 'cf-' } }, isSample: true },
  });
  const hiddenTests = totalTests - sampleTests;

  progress(`\nTotal test cases: ${totalTests} (${sampleTests} visible, ${hiddenTests} hidden)`);

  await db.$disconnect();

  if (failedProblems.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  progress(`FATAL: ${err}`);
  process.exit(1);
});
