/**
 * Simple in-process concurrency limiter for judge submissions.
 *
 * Prevents too many simultaneous Judge0 requests from overwhelming the
 * judge server. Uses a counting semaphore pattern.
 *
 * Configured via JUDGE_CONCURRENCY env var (default 4).
 */

const MAX_CONCURRENT = Number(process.env.JUDGE_CONCURRENCY ?? 4);
let activeCount = 0;
const waitQueue: (() => void)[] = [];

export async function withJudgeConcurrency<T>(fn: () => Promise<T>): Promise<T> {
  // Wait for a slot
  if (activeCount >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => waitQueue.push(resolve));
  }
  activeCount++;

  try {
    return await fn();
  } finally {
    activeCount--;
    const next = waitQueue.shift();
    if (next) next();
  }
}

/** Current number of active judge jobs (for monitoring). */
export function getActiveJudgeCount(): number {
  return activeCount;
}
