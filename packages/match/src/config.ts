/**
 * Centralised match configuration.
 *
 * Reads from env at module load so the whole process agrees on one ruleset.
 * Override per-environment via .env — never hardcode in features.
 */

export interface MatchConfig {
  /** Total battle clock, in seconds. Default 20 minutes. */
  durationSeconds: number;
  /** Points per difficulty for a clean solve. */
  points: { EASY: number; MEDIUM: number; HARD: number };
  /** Subtracted from a problem's score for each wrong (non-AC) submission. */
  wrongSubmissionPenalty: number;
  /** Matchmaking: initial ELO window, in rating points. */
  matchmakingBaseWindow: number;
  /** Matchmaking: how much the window grows per second waited. */
  matchmakingWindowGrowthPerSec: number;
  /** Matchmaking: hard cap on the window. */
  matchmakingMaxWindow: number;
}

function num(env: string | undefined, fallback: number): number {
  if (env == null || env.trim() === '') return fallback;
  const n = Number(env);
  return Number.isFinite(n) ? n : fallback;
}

export const MATCH_CONFIG: MatchConfig = {
  durationSeconds: num(process.env.MATCH_DURATION_SECONDS, 1200),
  points: { EASY: 100, MEDIUM: 200, HARD: 350 },
  wrongSubmissionPenalty: num(process.env.WRONG_SUBMISSION_PENALTY, 10),
  matchmakingBaseWindow: 50,
  matchmakingWindowGrowthPerSec: 5,
  matchmakingMaxWindow: 250,
};

/**
 * Compute the matchmaking ELO window for a player who has been queuing for
 * `secondsWaited`. Widens over time so nobody waits forever.
 */
export function matchmakingWindow(secondsWaited: number): number {
  const grown =
    MATCH_CONFIG.matchmakingBaseWindow +
    secondsWaited * MATCH_CONFIG.matchmakingWindowGrowthPerSec;
  return Math.min(grown, MATCH_CONFIG.matchmakingMaxWindow);
}
