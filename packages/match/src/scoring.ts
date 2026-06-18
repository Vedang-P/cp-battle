/**
 * Scoring logic for a match.
 *
 * Per-problem score:
 *   points(difficulty) - wrongSubmissions * penalty, floored at 0
 * Only SOLVED problems earn points.
 *
 * Winner determination:
 *   Sprint: first to solve all problems wins (no scoring needed during match).
 *   Progressive: higher solved count wins; tiebreak on total score, then fewer
 *   wrong submissions, then faster total solve time. True tie => draw.
 *
 * All pure functions so they're trivial to unit test.
 */

import type { Difficulty } from '@zapdos/db';
import { MATCH_CONFIG, type MatchModeType } from './config';

export interface ProblemScoreInput {
  difficulty: Difficulty;
  status: 'LOCKED' | 'UNLOCKED' | 'SOLVED';
  wrongSubmissions: number;
  /** When the player solved it (ms epoch), if solved. Used only for tiebreak. */
  solvedAtMs: number | null;
  /** Points the problem is worth (from the Problem.points column). */
  points: number;
}

/** Score for a single problem in the match. */
export function problemScore(input: ProblemScoreInput): number {
  if (input.status !== 'SOLVED') return 0;
  return Math.max(0, input.points - input.wrongSubmissions * MATCH_CONFIG.wrongSubmissionPenalty);
}

export interface PlayerTally {
  totalScore: number;
  /** Sum of (solve time - match start) across solved problems, in ms. Lower = faster. */
  totalSolveMs: number;
  solvedCount: number;
  totalWrongSubmissions: number;
}

/** Roll up a player's problem scores into a match tally. */
export function tallyPlayer(
  problems: ProblemScoreInput[],
  matchStartMs: number,
): PlayerTally {
  let totalScore = 0;
  let totalSolveMs = 0;
  let solvedCount = 0;
  let totalWrongSubmissions = 0;
  for (const p of problems) {
    totalScore += problemScore(p);
    totalWrongSubmissions += p.wrongSubmissions;
    if (p.status === 'SOLVED' && p.solvedAtMs != null) {
      solvedCount++;
      totalSolveMs += Math.max(0, p.solvedAtMs - matchStartMs);
    }
  }
  return { totalScore, totalSolveMs, solvedCount, totalWrongSubmissions };
}

export type MatchOutcome = 'A_WINS' | 'B_WINS' | 'DRAW';

/**
 * Decide the outcome from two tallies.
 *
 * Sprint mode: solvedCount wins (should always be 3 vs <3 or both 3 → score wins).
 * Progressive mode: solvedCount wins, tiebreak on totalScore → fewer wrongs → faster.
 */
export function decideOutcome(
  a: PlayerTally,
  b: PlayerTally,
  mode: MatchModeType,
): MatchOutcome {
  // Primary: most problems solved
  if (a.solvedCount !== b.solvedCount) {
    return a.solvedCount > b.solvedCount ? 'A_WINS' : 'B_WINS';
  }

  // Tiebreak 1: total score (rewards harder problems)
  if (a.totalScore !== b.totalScore) {
    return a.totalScore > b.totalScore ? 'A_WINS' : 'B_WINS';
  }

  // Tiebreak 2: fewer total wrong submissions
  if (a.totalWrongSubmissions !== b.totalWrongSubmissions) {
    return a.totalWrongSubmissions < b.totalWrongSubmissions ? 'A_WINS' : 'B_WINS';
  }

  // Tiebreak 3: faster aggregate solve time
  if (a.totalSolveMs !== b.totalSolveMs) {
    return a.totalSolveMs < b.totalSolveMs ? 'A_WINS' : 'B_WINS';
  }

  return 'DRAW';
}
