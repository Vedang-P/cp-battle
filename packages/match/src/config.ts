/**
 * Centralised match configuration.
 *
 * Reads from env at module load so the whole process agrees on one ruleset.
 * Override per-environment via .env — never hardcode in features.
 */

export type MatchModeType = 'SPRINT' | 'PROGRESSIVE';

export interface MatchModeConfig {
  /** Problem composition: [count, difficulty] pairs in sequence order. */
  composition: Array<{ count: number; difficulty: 'EASY' | 'MEDIUM' | 'HARD' }>;
  /** Total problems in this mode. */
  totalProblems: number;
  /** Duration in seconds. */
  durationSeconds: number;
  /** Points per difficulty for a clean solve. */
  points: { EASY: number; MEDIUM: number; HARD: number };
}

export interface MatchConfig {
  /** Default mode for new matches. */
  defaultMode: MatchModeType;
  /** Per-mode configuration. */
  modes: Record<MatchModeType, MatchModeConfig>;
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
  defaultMode: 'SPRINT',
  modes: {
    SPRINT: {
      composition: [
        { count: 2, difficulty: 'EASY' },
        { count: 1, difficulty: 'MEDIUM' },
      ],
      totalProblems: 3,
      durationSeconds: num(process.env.MATCH_DURATION_SECONDS, 1200),
      points: { EASY: 100, MEDIUM: 250, HARD: 400 },
    },
    PROGRESSIVE: {
      composition: [
        { count: 3, difficulty: 'EASY' },
        { count: 3, difficulty: 'MEDIUM' },
        { count: 2, difficulty: 'HARD' },
      ],
      totalProblems: 8,
      durationSeconds: num(process.env.MATCH_DURATION_SECONDS, 1200),
      points: { EASY: 100, MEDIUM: 250, HARD: 400 },
    },
  },
  wrongSubmissionPenalty: num(process.env.WRONG_SUBMISSION_PENALTY, 10),
  matchmakingBaseWindow: 50,
  matchmakingWindowGrowthPerSec: 5,
  matchmakingMaxWindow: 250,
};

/** Shorthand to get config for a specific mode. */
export function modeConfig(mode: MatchModeType): MatchModeConfig {
  return MATCH_CONFIG.modes[mode];
}

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
