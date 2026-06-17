/**
 * Piston API client + job execution.
 *
 * Piston runs one job at a time: given language + source + stdin, it returns
 * stdout/stderr/exit info. To judge a submission we call this once per test
 * case (sequential, since order matters and concurrency is queue-controlled).
 *
 * Piston API shape (v2):
 *   POST /api/v2/execute
 *   { language, version, files:[{name,content}], compile?, run, stdin,
 *     cpu_time_limit, memory_limit, ... }
 *   -> { run: { stdout, stderr, code, signal, output },
 *        compile: { stdout, stderr, code, signal, output } | null }
 */

import type { LanguageConfig } from './languages.js';

const PISTON_URL = process.env.PISTON_URL ?? 'http://localhost:2000';

export interface PistonRunResult {
  /** Combined compile output (if the language compiles). null if interpreted. */
  compile: { stdout: string; stderr: string; code: number | null } | null;
  /** Runtime result for this particular stdin. */
  run: {
    stdout: string;
    stderr: string;
    code: number | null; // null = killed by signal (timeout/OOM)
    signal: string | null;
    // Piston reports cpu/mem where available; null if not.
    cpu_time_ms: number | null;
    memory_bytes: number | null;
  };
}

export interface ExecuteOptions {
  language: LanguageConfig;
  source: string;
  stdin: string;
  /** Effective CPU time limit in ms, already language-adjusted. */
  cpuTimeLimitMs: number;
  /** Effective memory limit in MB, already language-adjusted. */
  memoryLimitMb: number;
  /** Per-request timeout for the HTTP call itself (must exceed cpu limit). */
  httpTimeoutMs?: number;
}

interface PistonExecuteResponse {
  language: string;
  version: string;
  run?: PistonRunResult['run'];
  compile?: { stdout: string; stderr: string; code: number | null; signal: string | null };
}

/** Run a single program against a single stdin. Throws on network/HTTP errors. */
export async function executeOnce(opts: ExecuteOptions): Promise<PistonRunResult> {
  const { language, source, stdin, cpuTimeLimitMs, memoryLimitMb, httpTimeoutMs } = opts;

  // Piston wants the source file named to match compile/run expectations.
  const filename = language.compile
    ? language.id === 'java'
      ? 'Main.java' // matches `javac Main.java`
      : `main.${language.extension}`
    : `main.${language.extension}`;

  const body = {
    language: language.pistonLanguage,
    version: language.pistonVersion,
    files: [{ name: filename, content: source }],
    compile: language.compile ?? undefined,
    run: { stdin },
    // Piston takes cpu_time_limit in seconds.
    cpu_time_limit: Math.max(0.5, cpuTimeLimitMs / 1000),
    memory_limit: memoryLimitMb * 1024 * 1024, // bytes
    compile_memory_limit: 512 * 1024 * 1024,
    run_memory_limit: memoryLimitMb * 1024 * 1024,
  };

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    httpTimeoutMs ?? cpuTimeLimitMs + 5000,
  );

  try {
    const res = await fetch(`${PISTON_URL}/api/v2/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Piston HTTP ${res.status}: ${text}`);
    }

    const data = (await res.json()) as PistonExecuteResponse;

    return {
      compile: data.compile
        ? { stdout: data.compile.stdout, stderr: data.compile.stderr, code: data.compile.code }
        : null,
      run: {
        stdout: data.run?.stdout ?? '',
        stderr: data.run?.stderr ?? '',
        code: data.run?.code ?? null,
        signal: data.run?.signal ?? null,
        // Piston doesn't always populate these; we synthesize them elsewhere if absent.
        cpu_time_ms: null,
        memory_bytes: null,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Liveness check used by health endpoints. */
export async function pingPiston(): Promise<boolean> {
  try {
    const res = await fetch(`${PISTON_URL}/api/v2/runtimes`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
