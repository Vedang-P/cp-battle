/**
 * Judge0 CE API client + job execution.
 *
 * Drop-in replacement for the Piston client. Implements the same `executeOnce`
 * and `pingPiston` interfaces so the rest of the judge pipeline (`judge.ts`,
 * `compare.ts`) stays unchanged.
 *
 * Judge0 API shape (v1.13.1):
 *   POST /submissions?base64_encoded=true&wait=true
 *   { language_id, source_code (base64), stdin (base64), compiler_options?,
 *     cpu_time_limit, cpu_extra_time, memory_limit, ... }
 *   -> { stdout (base64), stderr (base64), compile_output (base64), time, memory,
 *        status: { id, description }, exit_code, ... }
 *
 * IMPORTANT: We use base64 encoding because Judge0 CE v1.13.1 fails with
 * "cannot be converted to UTF-8" when compiler_options contain special chars
 * like `++` in `-std=c++17`.
 */

import type { LanguageConfig } from './languages';

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

const JUDGE0_URL = process.env.JUDGE0_URL ?? 'http://localhost:2358';
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY ?? '';

function getJudge0Headers(): Record<string, string> {
  if (JUDGE0_API_KEY) {
    return {
      'X-RapidAPI-Key': JUDGE0_API_KEY,
      'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
    };
  }
  return {};
}

/**
 * Judge0 language IDs for the languages Zapdos supports.
 * These match Judge0 CE v1.13.1.
 */
const JUDGE0_LANGUAGE_IDS: Record<string, number> = {
  cpp: 54,     // C++ (GCC 9.2.0)
  python: 71,  // Python (3.8.1)
  java: 62,    // Java (OpenJDK 13.0.1)
};

/**
 * Judge0 status IDs that map to our verdicts.
 */
const Judge0Status = {
  ACCEPTED: 3,
  TLE: 4,
  TLE_ALT: 5,
  MLE: 6,
  RE_SIGSEGV: 7,
  RE_SIGXFSZ: 8,
  RE_SIGFPE: 9,
  RE_SIGABRT: 10,
  RE_NZEC: 11,
  RE_OTHER: 12,
  INTERNAL_ERROR: 13,
  EXEC_FORMAT_ERROR: 14,
} as const;

export interface PistonRunResult {
  compile: { stdout: string; stderr: string; code: number | null } | null;
  run: {
    stdout: string;
    stderr: string;
    code: number | null;
    signal: string | null;
    cpu_time_ms: number | null;
    memory_bytes: number | null;
  };
}

export interface ExecuteOptions {
  language: LanguageConfig;
  source: string;
  stdin: string;
  cpuTimeLimitMs: number;
  memoryLimitMb: number;
  httpTimeoutMs?: number;
}

interface Judge0SubmissionResponse {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  time: string | null;
  memory: number | null;
  exit_code: number | null;
  status: { id: number; description: string };
  message: string | null;
}

interface Judge0ErrorResponse {
  error: string;
  token?: string;
}

/**
 * Global throttle on concurrent Judge0 requests.
 *
 * Judge0 runs a fixed pool of workers (3 in production) on a small VM. If the
 * web app fires more concurrent requests than there are workers, the surplus
 * queues — inflating wall-clock time and risking false TLE (both wall-time
 * limit and our HTTP abort can trip on a CORRECT but queued submission).
 *
 * This semaphore caps total in-flight Judge0 requests across ALL submissions
 * to match the worker pool. Configured via JUDGE0_MAX_CONCURRENT (default 3).
 */
const JUDGE0_MAX_CONCURRENT = (() => {
  const v = Number(process.env.JUDGE0_MAX_CONCURRENT ?? '3');
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 3;
})();

let activeJudge0 = 0;
const judge0Queue: (() => void)[] = [];

function acquireJudge0Slot(): Promise<void> {
  if (activeJudge0 < JUDGE0_MAX_CONCURRENT) {
    activeJudge0++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    judge0Queue.push(() => {
      activeJudge0++;
      resolve();
    });
  });
}

function releaseJudge0Slot(): void {
  activeJudge0--;
  const next = judge0Queue.shift();
  if (next) next();
}

function decodeBase64(s: string | null): string {
  if (!s) return '';
  return Buffer.from(s, 'base64').toString('utf-8');
}

function mapJudge0ToPistonResult(data: Judge0SubmissionResponse): PistonRunResult {
  const compileOutput = decodeBase64(data.compile_output);
  const hasCompileOutput = compileOutput.trim().length > 0;
  const compileFailed = hasCompileOutput && data.status.id !== Judge0Status.ACCEPTED;

  return {
    compile: hasCompileOutput
      ? {
          stdout: '',
          stderr: compileOutput,
          code: compileFailed ? 1 : 0,
        }
      : null,
    run: {
      stdout: decodeBase64(data.stdout),
      stderr: decodeBase64(data.stderr),
      code: data.exit_code ?? 0,
      signal: mapStatusToSignal(data.status.id),
      cpu_time_ms: data.time ? Math.round(parseFloat(data.time) * 1000) : null,
      memory_bytes: data.memory ? data.memory * 1024 : null, // Judge0 reports KB
    },
  };
}

function mapStatusToSignal(statusId: number): string | null {
  switch (statusId) {
    case Judge0Status.TLE:
    case Judge0Status.TLE_ALT:
      return 'SIGKILL';
    case Judge0Status.MLE:
      return 'SIGOOM'; // distinct from SIGKILL (TLE) so classifyRun can emit MLE
    case Judge0Status.RE_SIGSEGV:
      return 'SIGSEGV';
    case Judge0Status.RE_SIGFPE:
    case Judge0Status.RE_SIGXFSZ:
    case Judge0Status.RE_SIGABRT:
      return 'SIGBUS';
    default:
      return null;
  }
}

export async function executeOnce(opts: ExecuteOptions): Promise<PistonRunResult> {
  const { language, source, stdin, cpuTimeLimitMs, memoryLimitMb, httpTimeoutMs } = opts;

  const languageId = JUDGE0_LANGUAGE_IDS[language.id];
  if (!languageId) {
    throw new Error(`Unsupported language for Judge0: ${language.id}`);
  }

  // NOTE: The Judge0 server runs GCC 9.2.0 (verified via /languages/54), which
  // does NOT support -std=c++20 (that needs GCC 10+). Using c++20 here makes the
  // compiler reject the flag and turns EVERY C++ submission into a compile error.
  // Keep c++17 until the Judge0 image is upgraded to a newer GCC.
  const compilerOptions =
    language.id === 'cpp' ? '-O2 -std=c++17' : undefined;

  const params = new URLSearchParams({
    base64_encoded: 'true',
    wait: 'true',
  });

  // CPU limit as a float (Judge0 accepts decimals) — avoids the lossy
  // integer rounding that could silently shrink a 1.5s limit. Floor at 1s.
  const cpuSeconds = Math.max(1, Number((cpuTimeLimitMs / 1000).toFixed(2)));
  // Wall limit must be generous: under CPU contention a CORRECT program needs
  // far more wall time than CPU time. A tight wall limit causes false TLE.
  const wallSeconds = Math.min(60, Math.ceil(cpuSeconds) + 10);

  const body: Record<string, unknown> = {
    language_id: languageId,
    source_code: Buffer.from(source).toString('base64'),
    stdin: Buffer.from(stdin).toString('base64'),
    cpu_time_limit: cpuSeconds,
    cpu_extra_time: 2,
    wall_time_limit: wallSeconds,
    // Memory limit in KB. Cap at Judge0 CE max (512000 KB).
    // Use at least 128MB for compilation.
    memory_limit: Math.min(Math.max(memoryLimitMb * 1024, 128000), 512000),
    stack_limit: 128000,
    max_file_size: 4096,
    enable_network: false,
    enable_per_process_and_thread_time_limit: true,
    // Java's JVM cannot allocate its heap when per-process memory limits are
    // enforced via ulimit (cgroups disabled on Judge0 CE). Disable for Java.
    enable_per_process_and_thread_memory_limit: language.id !== 'java',
  };

  if (compilerOptions) {
    body.compiler_options = compilerOptions;
  }

  // Acquire a Judge0 slot BEFORE starting the abort timer, so queue-wait time
  // is never counted against the request's HTTP timeout (which would falsely
  // surface as TLE for a submission that simply waited in line).
  await acquireJudge0Slot();

  const controller = new AbortController();
  // HTTP timeout generously exceeds the wall limit so a legitimately slow
  // (but within-limit) run completes rather than aborting into a false TLE.
  const httpTimeout = httpTimeoutMs ?? wallSeconds * 1000 + 20000;
  const timer = setTimeout(() => controller.abort(), httpTimeout);

  try {
    // Submit the code
    const res = await fetch(`${JUDGE0_URL}/submissions?${params}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getJudge0Headers(),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Judge0 HTTP ${res.status}: ${text}`);
    }

    const data = await res.json();

    // If wait=true isn't supported, Judge0 returns {token: "..."}.
    // We need to poll for the result.
    let resultData: Judge0SubmissionResponse;
    if (data.token && !data.status) {
      resultData = await pollForResult(data.token, controller.signal);
    } else {
      resultData = data as Judge0SubmissionResponse;
    }

    // Judge0 returns an error object instead of status when something is wrong
    if ('error' in resultData) {
      throw new Error(`Judge0 error: ${(resultData as unknown as Judge0ErrorResponse).error}`);
    }

    return mapJudge0ToPistonResult(resultData);
  } catch (err) {
    // Map AbortError to TLE so the submission route shows TLE instead of CE
    if (err instanceof Error && err.name === 'AbortError') {
      throw new TimeoutError(`Judge0 request timed out after ${httpTimeout}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
    releaseJudge0Slot();
  }
}

/**
 * Poll Judge0 for a submission result by token.
 * Retries every 200ms until the submission is no longer "In Queue" or "Processing".
 */
async function pollForResult(token: string, signal: AbortSignal): Promise<Judge0SubmissionResponse> {
  const maxAttempts = 300; // 60 seconds max (300 * 200ms)
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (signal.aborted) throw new TimeoutError('Polling aborted');

    const res = await fetch(`${JUDGE0_URL}/submissions/${token}?base64_encoded=true`, {
      headers: getJudge0Headers(),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Judge0 poll HTTP ${res.status}: ${text}`);
    }

    const data = (await res.json()) as Judge0SubmissionResponse;

    // Status IDs: 1=In Queue, 2=Processing, 3+=Done (AC/WA/TLE/etc.)
    if (data.status && data.status.id > 2) {
      return data;
    }
  }
  throw new TimeoutError(`Judge0 submission ${token} timed out after polling`);
}

/** Liveness check used by health endpoints. */
export async function pingPiston(): Promise<boolean> {
  try {
    const res = await fetch(`${JUDGE0_URL}/languages`, {
      headers: getJudge0Headers(),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
