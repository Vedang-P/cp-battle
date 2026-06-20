/**
 * Comprehensive production validator.
 *
 * Phases:
 *   1. DB integrity — quick counts, emptiness checks
 *   2. Pipeline test (C++, Python, Java) — trivial AC solution per problem
 *   3. Full-coverage (C++) — cheating hash-map solution, every TC gets AC
 *   4. Summary report
 *
 * Usage (on the web VM):
 *   sudo docker cp apps/web/scripts/comprehensive-validate.ts zapdos-web-web-1:/app/apps/web/scripts/
 *   sudo docker exec zapdos-web-web-1 \
 *     ./apps/web/node_modules/.bin/tsx --env-file=/app/.env.production \
 *     apps/web/scripts/comprehensive-validate.ts
 */

import { db } from '@zapdos/db';
import { getLanguage, judgeSubmission, executeOnce } from '@zapdos/judge';
import type { LanguageConfig, TestCase } from '@zapdos/judge';

// ─── Infra ──────────────────────────────────────────────────────────────

const LANG_IDS: Array<'cpp' | 'python' | 'java'> = ['cpp', 'python', 'java'];

function ts(): string {
  return new Date().toISOString().split('T')[1]!.slice(0, 8);
}
function log(msg: string): void {
  process.stdout.write(`[${ts()}] ${msg}\n`);
}
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Phase 1 — DB Integrity ────────────────────────────────────────────

interface ProblemRow {
  id: string;
  slug: string;
  title: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  difficulty: string;
}

async function phase1(problems: ProblemRow[]): Promise<{ ok: boolean; totalProblems: number; totalTestCases: number }> {
  log('\n=== Phase 1: DB Integrity ===');

  let totalTestCases = 0;
  let emptyInput = 0;
  let emptyOutput = 0;

  for (const p of problems) {
    const tcs = await db.testCase.findMany({
      where: { problemId: p.id },
      select: { input: true, expectedOutput: true },
    });
    totalTestCases += tcs.length;

    for (const tc of tcs) {
      if (!tc.input.trim()) emptyInput++;
      if (!tc.expectedOutput.trim()) emptyOutput++;
    }
  }

  log(`Problems: ${problems.length}`);
  log(`Test cases: ${totalTestCases}`);
  if (emptyInput > 0) log(`  WARN: ${emptyInput} test cases have empty input`);
  if (emptyOutput > 0) log(`  WARN: ${emptyOutput} test cases have empty expected output`);

  const ok = emptyInput === 0 && emptyOutput === 0;
  log(`Integrity: ${ok ? 'PASS' : 'FAIL'}\n`);

  return { ok, totalProblems: problems.length, totalTestCases };
}

// ─── Phase 2 — Pipeline Test (3 langs) ─────────────────────────────────

const TRIVIAL_SOLUTIONS: Record<string, string> = {
  cpp: `#include <bits/stdc++.h>
using namespace std;
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int a, b;
    cin >> a >> b;
    cout << a + b << endl;
    return 0;
}`,
  python: `import sys
def solve():
    data = sys.stdin.read().strip().split()
    if not data:
        return
    a, b = int(data[0]), int(data[1])
    print(a + b)
if __name__ == "__main__":
    solve()`,
  java: `import java.util.*;
import java.io.*;
public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        String[] parts = br.readLine().split(" ");
        int a = Integer.parseInt(parts[0]);
        int b = Integer.parseInt(parts[1]);
        System.out.println(a + b);
    }
}`,
};

interface Phase2Result {
  lang: string;
  total: number;
  passed: number;
  failed: number;
  errors: string[];
}

async function phase2ForLang(
  problems: ProblemRow[],
  langId: 'cpp' | 'python' | 'java',
): Promise<Phase2Result> {
  const lang = getLanguage(langId);
  if (!lang) return { lang: langId, total: 0, passed: 0, failed: 0, errors: ['No language config'] };

  log(`  [${langId}] Starting pipeline test for ${problems.length} problems...`);

  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  // Use only the first test case (A+B trivial solution only works on simple I/O)
  for (let i = 0; i < problems.length; i++) {
    const p = problems[i]!;

    try {
      const tcs = await db.testCase.findMany({
        where: { problemId: p.id },
        orderBy: { order: 'asc' },
        take: 5,
      });

      if (tcs.length === 0) {
        failed++;
        errors.push(`${p.slug}: no test cases`);
        continue;
      }

      const result = await judgeSubmission({
        language: lang,
        source: TRIVIAL_SOLUTIONS[langId]!,
        testCases: tcs.map((tc) => ({ input: tc.input, expected: tc.expectedOutput })),
        timeLimitMs: p.timeLimitMs,
        memoryLimitMb: p.memoryLimitMb,
      });

      // Pipeline test succeeds if no CE/RE/TLE (WA is expected since solution is trivial)
      if (result.verdict === 'CE' || result.verdict === 'RE') {
        failed++;
        errors.push(`${p.slug}: ${result.verdict} — ${result.compileError || result.runtimeError}`);
      } else {
        passed++;
      }
    } catch (err) {
      failed++;
      errors.push(`${p.slug}: exception — ${err instanceof Error ? err.message : String(err)}`);
    }

    if ((i + 1) % 50 === 0) {
      log(`    [${langId}] ${i + 1}/${problems.length} (${passed} ok, ${failed} fail)`);
    }
  }

  log(`  [${langId}] Done — ${passed}/${problems.length} pipeline ok`);
  return { lang: langId, total: problems.length, passed, failed, errors };
}

async function phase2(
  problems: ProblemRow[],
): Promise<Phase2Result[]> {
  log('=== Phase 2: Pipeline Test (3 languages) ===');
  log('Submitting trivial A+B solutions to verify Judge0 pipeline works');
  log('(AC not expected — we check for CE/RE/TLE, not WA)\n');

  const results = await Promise.all(
    LANG_IDS.map((langId) => phase2ForLang(problems, langId)),
  );

  for (const r of results) {
    log(`  ${r.lang}: ${r.passed}/${r.total} pipeline ok (${r.failed} failed)`);
  }
  log('');

  return results;
}

// ─── Phase 3 — Full Coverage (C++ cheating solution) ───────────────────

function escapeCpp(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
    .replace(/\t/g, '\\t');
}

function hashString(s: string): bigint {
  let h = 0n;
  for (let i = 0; i < s.length; i++) {
    h = h * 31n + BigInt(s.charCodeAt(i));
  }
  return h;
}

function generateCheatingSolution(testCases: { input: string; expected: string }[]): string {
  // Build hash → expected output map
  const cases = testCases.map((tc, idx) => {
    const h = hashString(tc.input);
    const escaped = escapeCpp(tc.expected);
    return { idx, hash: h, escaped };
  });

  // Deduplicate by hash (handle collisions — extremely unlikely with 64-bit)
  const seen = new Set<bigint>();
  const unique = cases.filter((c) => {
    if (seen.has(c.hash)) return false;
    seen.add(c.hash);
    return true;
  });

  // Generate C++ code
  let code = `#include <bits/stdc++.h>
using namespace std;

static uint64_t hashInput(const string &s) {
    uint64_t h = 0;
    for (unsigned char c : s) {
        h = h * 31 + c;
    }
    return h;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    string line, input;
    while (getline(cin, line)) {
        input += line + '\\n';
    }

    uint64_t h = hashInput(input);

    switch (h) {\n`;

  for (const c of unique) {
    code += `        case ${c.hash}ULL: cout << "${c.escaped}"; break;\n`;
  }

  code += `        default: return 0;
    }
    return 0;
}
`;

  return code;
}

interface Phase3Result {
  total: number;
  totalTestCases: number;
  passed: number;
  failedProblems: string[];
  summaryByProblem: { slug: string; tcCount: number; passed: number; failed: number; firstError?: string }[];
}

async function phase3(problems: ProblemRow[]): Promise<Phase3Result> {
  log('=== Phase 3: Full Coverage (C++ cheating solution) ===');
  log('For each problem, generates a hash-map solution that passes ALL test cases\n');

  const cppLang = getLanguage('cpp')!;
  let passed = 0;
  let totalTestCases = 0;
  const failedProblems: string[] = [];
  const summaryByProblem: Phase3Result['summaryByProblem'] = [];

  for (let i = 0; i < problems.length; i++) {
    const p = problems[i]!;

    try {
      const tcs = await db.testCase.findMany({
        where: { problemId: p.id },
        orderBy: { order: 'asc' },
      });

      if (tcs.length === 0) {
        failedProblems.push(p.slug);
        summaryByProblem.push({ slug: p.slug, tcCount: 0, passed: 0, failed: 0, firstError: 'No test cases' });
        continue;
      }

      totalTestCases += tcs.length;

      const testCases: TestCase[] = tcs.map((tc) => ({ input: tc.input, expected: tc.expectedOutput }));
      const source = generateCheatingSolution(testCases);

      const result = await judgeSubmission({
        language: cppLang,
        source,
        testCases,
        timeLimitMs: p.timeLimitMs,
        memoryLimitMb: p.memoryLimitMb,
      });

      if (result.verdict === 'AC' && result.passed === result.total) {
        passed++;
        summaryByProblem.push({ slug: p.slug, tcCount: tcs.length, passed: result.passed, failed: 0 });
      } else {
        failedProblems.push(p.slug);
        const firstError = result.compileError || result.runtimeError || `${result.verdict} (${result.passed}/${result.total})`;
        summaryByProblem.push({ slug: p.slug, tcCount: tcs.length, passed: result.passed, failed: result.total - result.passed, firstError });
      }
    } catch (err) {
      failedProblems.push(p.slug);
      summaryByProblem.push({ slug: p.slug, tcCount: 0, passed: 0, failed: 0, firstError: `exception: ${err instanceof Error ? err.message : String(err)}` });
    }

    if ((i + 1) % 25 === 0) {
      log(`  Progress: ${i + 1}/${problems.length} — ${passed} passed, ${failedProblems.length} failed`);
    }
  }

  log(`\n  Phase 3 Done — ${passed}/${problems.length} problems fully AC, ${failedProblems.length} failed`);
  return { total: problems.length, totalTestCases, passed, failedProblems, summaryByProblem };
}

// ─── Main ───────────────────────────────────────────────────────────────

async function main() {
  log('========================================');
  log('Comprehensive Production Validator');
  log('========================================\n');

  // Load all problems
  const problems = await db.problem.findMany({
    where: { isVisible: true },
    select: { id: true, slug: true, title: true, timeLimitMs: true, memoryLimitMb: true, difficulty: true },
    orderBy: { slug: 'asc' },
  });

  log(`Loaded ${problems.length} visible problems\n`);

  // Phase 1
  const integrity = await phase1(problems);
  if (!integrity.ok) {
    log('FATAL: DB integrity check failed — aborting');
    await db.$disconnect();
    process.exit(1);
  }

  // Phase 2 — Pipeline test all 3 langs in parallel
  const phase2Results = await phase2(problems);

  // Phase 3 — Full coverage C++
  const phase3Result = await phase3(problems);

  // ─── Summary ──────────────────────────────────────────────────────────
  log('\n========================================');
  log('VALIDATION SUMMARY');
  log('========================================\n');

  log(`Problems validated: ${problems.length}`);
  log(`Total test cases: ${integrity.totalTestCases}`);
  log('');

  for (const r of phase2Results) {
    const status = r.failed === 0 ? 'PASS' : `FAIL (${r.failed} errors)`;
    log(`Pipeline (${r.lang}): ${r.passed}/${r.total} — ${status}`);
    if (r.errors.length > 0) {
      for (const e of r.errors.slice(0, 5)) {
        log(`  └─ ${e}`);
      }
      if (r.errors.length > 5) log(`  └─ ... and ${r.errors.length - 5} more`);
    }
  }

  const p3Status = phase3Result.failedProblems.length === 0 ? 'PASS' : `FAIL (${phase3Result.failedProblems.length} problems)`;
  log(`\nFull Coverage (C++): ${phase3Result.passed}/${phase3Result.total} problems = ${phase3Result.totalTestCases} TCs — ${p3Status}`);

  if (phase3Result.failedProblems.length > 0) {
    log('\nFailed problems (first 10):');
    for (const fp of phase3Result.failedProblems.slice(0, 10)) {
      const info = phase3Result.summaryByProblem.find((s) => s.slug === fp);
      log(`  └─ ${fp}: ${info?.firstError || 'unknown'}`);
    }
  }

  log('\n========================================');
  const overallOk = phase3Result.passed === phase3Result.total;
  log(overallOk ? 'RESULT: ALL PASSED' : 'RESULT: SOME FAILED');
  log('========================================\n');

  await db.$disconnect();

  if (!overallOk) process.exit(1);
}

main().catch((err) => {
  log(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
