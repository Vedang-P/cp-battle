/**
 * Test script — verifies Judge0 works for all 3 languages (C++, Python, Java).
 *
 * Submits correct solutions for a simple A+B problem and asserts AC.
 *
 * Usage:
 *   pnpm --env-file=../../.env tsx scripts/test-judge-languages.ts
 */

import { judgeSubmission, getLanguage } from '@zapdos/judge';
import type { LanguageId } from '@zapdos/judge';

const TEST_CASES = [
  { input: '1 2\n', expected: '3' },
  { input: '10 20\n', expected: '30' },
  { input: '-1 1\n', expected: '0' },
];

const SOLUTIONS: Record<LanguageId, string> = {
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    int a, b;
    cin >> a >> b;
    cout << a + b << endl;
    return 0;
}`,
  python: `a, b = map(int, input().split())
print(a + b)`,
  java: `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        StringTokenizer st = new StringTokenizer(br.readLine());
        int a = Integer.parseInt(st.nextToken());
        int b = Integer.parseInt(st.nextToken());
        System.out.println(a + b);
    }
}`,
};

function log(msg: string): void {
  const ts = new Date().toISOString().split('T')[1]!.slice(0, 8);
  process.stdout.write(`[${ts}] ${msg}\n`);
}

async function testLanguage(lang: LanguageId): Promise<boolean> {
  const langConfig = getLanguage(lang);
  if (!langConfig) {
    log(`  SKIP: Language config not found for ${lang}`);
    return false;
  }

  log(`  Testing ${langConfig.label}...`);
  try {
    const result = await judgeSubmission({
      language: langConfig,
      source: SOLUTIONS[lang],
      testCases: TEST_CASES,
      timeLimitMs: 2000,
      memoryLimitMb: 256,
    });

    log(`  Verdict: ${result.verdict} (${result.passed}/${result.total} passed)`);
    if (result.timeMs) log(`  Time: ${result.timeMs}ms`);
    if (result.memoryKb) log(`  Memory: ${result.memoryKb}KB`);
    if (result.compileError) log(`  Compile error: ${result.compileError}`);
    if (result.runtimeError) log(`  Runtime error: ${result.runtimeError}`);

    return result.verdict === 'AC' && result.passed === result.total;
  } catch (err) {
    log(`  ERROR: ${err}`);
    return false;
  }
}

async function main() {
  log('=== Language Test Script ===');
  log('Testing C++, Python, Java with A+B problem (3 test cases)');
  log('');

  const results: Record<string, boolean> = {};

  for (const lang of ['cpp', 'python', 'java'] as LanguageId[]) {
    results[lang] = await testLanguage(lang);
    log('');
  }

  log('=== Results ===');
  let allPassed = true;
  for (const [lang, passed] of Object.entries(results)) {
    const status = passed ? 'PASS' : 'FAIL';
    log(`  ${lang}: ${status}`);
    if (!passed) allPassed = false;
  }

  log('');
  if (allPassed) {
    log('All languages passed!');
    process.exit(0);
  } else {
    log('Some languages failed.');
    process.exit(1);
  }
}

main().catch((err) => {
  log(`FATAL: ${err}`);
  process.exit(1);
});
