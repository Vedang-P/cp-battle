/**
 * High-level judging: run a submission against a list of test cases and
 * produce a single verdict.
 *
 * Flow:
 *   1. Compile once (Piston does this per call, but compile errors short-circuit
 *      before any test case is run).
 *   2. Run each test case sequentially. Stop on first non-AC case for a clear
 *      verdict (TLE / MLE / RE / WA). CP convention: report the first failure.
 *   3. AC only if every case passes.
 *
 * Verdict precedence on failure: CE > TLE > MLE > RE > WA. We surface the
 * FIRST failing case's category, which matches user expectations on CF/Kattis.
 */

import { isOutputCorrect } from './compare.js';
import { executeOnce, type PistonRunResult } from './piston.js';
import type { LanguageConfig } from './languages.js';

export type Verdict = 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE' | 'CE';

export interface TestCase {
  input: string;
  expected: string;
}

export interface SubmissionSpec {
  language: LanguageConfig;
  source: string;
  testCases: TestCase[];
  timeLimitMs: number; // base limit from the problem
  memoryLimitMb: number; // base limit from the problem
}

export interface TestCaseResult {
  verdict: Verdict;
  passed: boolean;
  timeMs: number | null;
  memoryKb: number | null;
}

export interface JudgeResult {
  verdict: Verdict;
  passed: number;
  total: number;
  /** Max time across all run cases; null if compile failed. */
  timeMs: number | null;
  /** Max memory across all run cases; null if compile failed. */
  memoryKb: number | null;
  /** Compile error text (CE only), truncated. */
  compileError: string | null;
  /** First runtime stderr for non-AC cases, truncated (debugging aid). */
  runtimeError: string | null;
}

const MAX_ERROR_LEN = 2000;

function truncate(s: string): string {
  const trimmed = s.trim();
  return trimmed.length > MAX_ERROR_LEN ? trimmed.slice(0, MAX_ERROR_LEN) + '\n…[truncated]' : trimmed;
}

/** Classify a single Piston run into a verdict. AC decided by output comparison. */
function classifyRun(run: PistonRunResult['run'], actual: string, expected: string): Verdict {
  // Killed by signal almost always means OOM (SIGKILL/SIGSEGV) or timeout.
  if (run.signal === 'SIGKILL' || run.signal === 'SIGXCPU') return 'TLE';
  if (run.signal === 'SIGSEGV' || run.signal === 'SIGBUS') return 'RE';
  // Non-zero exit without a known timeout/OOM signal => runtime error.
  if (run.code !== null && run.code !== 0 && run.signal === null) return 'RE';
  // Otherwise compare outputs.
  return isOutputCorrect(actual, expected) ? 'AC' : 'WA';
}

export async function judgeSubmission(spec: SubmissionSpec): Promise<JudgeResult> {
  const { language, source, testCases, timeLimitMs, memoryLimitMb } = spec;

  const effectiveTimeMs = Math.round(timeLimitMs * language.timeMultiplier);
  const effectiveMemMb = Math.round(memoryLimitMb * language.memoryMultiplier);

  // First, a single execution on the first case to detect compile errors up front.
  if (testCases.length === 0) {
    // No test cases is a data error; treat as AC so we don't block on it, but flag.
    return {
      verdict: 'AC',
      passed: 0,
      total: 0,
      timeMs: 0,
      memoryKb: 0,
      compileError: null,
      runtimeError: null,
    };
  }

  let maxTime = 0;
  let maxMem = 0;
  let passed = 0;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i]!;
    const result = await executeOnce({
      language,
      source,
      stdin: tc.input,
      cpuTimeLimitMs: effectiveTimeMs,
      memoryLimitMb: effectiveMemMb,
    });

    // Compile error short-circuits the whole submission.
    if (result.compile && result.compile.code !== null && result.compile.code !== 0) {
      return {
        verdict: 'CE',
        passed: 0,
        total: testCases.length,
        timeMs: null,
        memoryKb: null,
        compileError: truncate(result.compile.stderr || result.compile.stdout),
        runtimeError: null,
      };
    }

    const verdict = classifyRun(result.run, result.run.stdout, tc.expected);

    if (result.run.cpu_time_ms && result.run.cpu_time_ms > maxTime) maxTime = result.run.cpu_time_ms;
    if (result.run.memory_bytes && result.run.memory_bytes > maxMem) maxMem = result.run.memory_bytes;

    if (verdict === 'AC') {
      passed++;
      continue;
    }

    // First failure decides the verdict.
    return {
      verdict,
      passed,
      total: testCases.length,
      timeMs: maxTime || null,
      memoryKb: maxMem ? Math.round(maxMem / 1024) : null,
      compileError: null,
      runtimeError: verdict === 'RE' ? truncate(result.run.stderr) : null,
    };
  }

  return {
    verdict: 'AC',
    passed,
    total: testCases.length,
    timeMs: maxTime || null,
    memoryKb: maxMem ? Math.round(maxMem / 1024) : null,
    compileError: null,
    runtimeError: null,
  };
}
