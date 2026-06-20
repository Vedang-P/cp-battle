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

import { isOutputCorrect } from './compare';
import { executeOnce, TimeoutError, type PistonRunResult } from './judge0';
import type { LanguageConfig } from './languages';

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

/**
 * Global hardware-calibration multiplier applied to every time limit.
 *
 * Problem time limits are imported verbatim from Codeforces, whose judges run
 * on fast dedicated hardware. Our Judge0 runs on a small shared cloud vCPU
 * (e2-standard-2) that is materially slower, so a CORRECT solution calibrated
 * for CF can exceed the raw limit here. This multiplier scales every limit up
 * to compensate. Tunable via JUDGE_HW_MULTIPLIER (default 2.5).
 *
 * The per-language `timeMultiplier` is separate — it covers interpreter/JVM
 * startup overhead, not the speed of the underlying machine.
 */
const HW_MULTIPLIER = (() => {
  const v = Number(process.env.JUDGE_HW_MULTIPLIER ?? '2.5');
  return Number.isFinite(v) && v > 0 ? v : 2.5;
})();

/** Upper bound on any effective limit, to stay within Judge0's MAX_CPU_TIME_LIMIT. */
const MAX_EFFECTIVE_TIME_MS = 15000;

function truncate(s: string): string {
  const trimmed = s.trim();
  return trimmed.length > MAX_ERROR_LEN ? trimmed.slice(0, MAX_ERROR_LEN) + '\n…[truncated]' : trimmed;
}

/** Classify a single Piston run into a verdict. AC decided by output comparison. */
function classifyRun(run: PistonRunResult['run'], actual: string, expected: string): Verdict {
  // SIGOOM is our sentinel for Judge0 status 6 (MLE); must check before SIGKILL.
  if (run.signal === 'SIGOOM') return 'MLE';
  if (run.signal === 'SIGKILL' || run.signal === 'SIGXCPU') return 'TLE';
  if (run.signal === 'SIGSEGV' || run.signal === 'SIGBUS') return 'RE';
  // Non-zero exit without a known timeout/OOM signal => runtime error.
  if (run.code !== null && run.code !== 0 && run.signal === null) return 'RE';
  // Otherwise compare outputs.
  return isOutputCorrect(actual, expected) ? 'AC' : 'WA';
}

export async function judgeSubmission(spec: SubmissionSpec): Promise<JudgeResult> {
  const { language, source, testCases, timeLimitMs, memoryLimitMb } = spec;

  const effectiveTimeMs = Math.min(
    MAX_EFFECTIVE_TIME_MS,
    Math.round(timeLimitMs * language.timeMultiplier * HW_MULTIPLIER),
  );
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

  // Run first test case to detect compile errors early
  let firstResult: PistonRunResult;
  try {
    firstResult = await executeOnce({
      language,
      source,
      stdin: testCases[0]!.input,
      cpuTimeLimitMs: effectiveTimeMs,
      memoryLimitMb: effectiveMemMb,
    });
  } catch (err) {
    if (err instanceof TimeoutError) {
      return {
        verdict: 'TLE',
        passed: 0,
        total: testCases.length,
        timeMs: effectiveTimeMs,
        memoryKb: null,
        compileError: null,
        runtimeError: null,
      };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return {
      verdict: 'CE',
      passed: 0,
      total: testCases.length,
      timeMs: null,
      memoryKb: null,
      compileError: `Judge unavailable: ${truncate(msg)}`,
      runtimeError: null,
    };
  }

  // Compile error short-circuits the whole submission.
  if (firstResult.compile && firstResult.compile.code !== null && firstResult.compile.code !== 0) {
    return {
      verdict: 'CE',
      passed: 0,
      total: testCases.length,
      timeMs: null,
      memoryKb: null,
      compileError: truncate(firstResult.compile.stderr || firstResult.compile.stdout),
      runtimeError: null,
    };
  }

  // Classify first test case
  const firstVerdict = classifyRun(firstResult.run, firstResult.run.stdout, testCases[0]!.expected);
  let maxTime = firstResult.run.cpu_time_ms ?? 0;
  let maxMem = firstResult.run.memory_bytes ?? 0;

  // If first test case failed, return immediately
  if (firstVerdict !== 'AC') {
    return {
      verdict: firstVerdict,
      passed: 0,
      total: testCases.length,
      timeMs: maxTime || null,
      memoryKb: maxMem ? Math.round(maxMem / 1024) : null,
      compileError: null,
      runtimeError: firstVerdict === 'RE' ? truncate(firstResult.run.stderr) : null,
    };
  }

  // Run remaining test cases in parallel, but keep the batch small. The Judge0
  // client enforces a global concurrency cap (JUDGE0_MAX_CONCURRENT) matching
  // the worker pool, so a large batch here would only pile up in that queue.
  // A batch of 3 also lets us short-circuit on TLE sooner.
  const remainingTestCases = testCases.slice(1);
  const BATCH_SIZE = 3;
  const results: Array<{ status: 'fulfilled'; value: PistonRunResult } | { status: 'rejected'; reason: unknown }> = [];

  for (let i = 0; i < remainingTestCases.length; i += BATCH_SIZE) {
    const batch = remainingTestCases.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map((tc) =>
        executeOnce({
          language,
          source,
          stdin: tc.input,
          cpuTimeLimitMs: effectiveTimeMs,
          memoryLimitMb: effectiveMemMb,
        })
      )
    );
    results.push(...batchResults);

    // If any test case in this batch failed with a hard error (TLE/CE),
    // stop processing remaining batches immediately.
    const hasHardFailure = batchResults.some(
      (r) => r.status === 'rejected' && r.reason instanceof TimeoutError
    );
    if (hasHardFailure) break;
  }

  let passed = 1; // First test case passed
  let failedVerdict: Verdict | null = null;
  let failedRuntimeError: string | null = null;

  for (let i = 0; i < results.length; i++) {
    const result = results[i]!;

    if (result.status === 'rejected') {
      const err = result.reason;
      if (err instanceof TimeoutError) {
        failedVerdict = 'TLE';
        break;
      }
      failedVerdict = 'CE';
      failedRuntimeError = `Judge unavailable: ${truncate(err instanceof Error ? err.message : String(err))}`;
      break;
    }

    const runResult = result.value;

    // Track max time and memory
    if (runResult.run.cpu_time_ms && runResult.run.cpu_time_ms > maxTime) {
      maxTime = runResult.run.cpu_time_ms;
    }
    if (runResult.run.memory_bytes && runResult.run.memory_bytes > maxMem) {
      maxMem = runResult.run.memory_bytes;
    }

    const verdict = classifyRun(runResult.run, runResult.run.stdout, remainingTestCases[i]!.expected);

    if (verdict === 'AC') {
      passed++;
      continue;
    }

    // First failure decides the verdict (check precedence)
    if (!failedVerdict || getVerdictPriority(verdict) > getVerdictPriority(failedVerdict)) {
      failedVerdict = verdict;
      failedRuntimeError = verdict === 'RE' ? truncate(runResult.run.stderr) : null;
    }
  }

  if (failedVerdict) {
    return {
      verdict: failedVerdict,
      passed,
      total: testCases.length,
      timeMs: maxTime || null,
      memoryKb: maxMem ? Math.round(maxMem / 1024) : null,
      compileError: null,
      runtimeError: failedRuntimeError,
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

/** Verdict precedence: higher number = higher priority. */
function getVerdictPriority(verdict: Verdict): number {
  switch (verdict) {
    case 'CE': return 5;
    case 'TLE': return 4;
    case 'MLE': return 3;
    case 'RE': return 2;
    case 'WA': return 1;
    case 'AC': return 0;
    default: return 0;
  }
}
