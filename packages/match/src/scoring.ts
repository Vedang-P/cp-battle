/**
 * Scoring logic for a match.
 *
 * Per-problem score:
 *   points(difficulty) - wrongSubmissions * penalty, floored at 0
 * Only SOLVED problems earn points.
 *
 * Match winner:
 *   higher total score wins; tiebreak on total solve time (faster wins);
 *   true tie => draw.
 *
 * All pure functions so they're trivial to unit test.
 */

import type { Difficulty } from '@cp-battle/db';
import { MATCH_CONFIG } from './config.js';

export interface ProblemScoreInput {
  difficulty: Difficulty;
  status: 'LOCKED' | 'UNLOCKED' | 'SOLVED';
  wrongSubmissions: number;
  /** When the player solved it (ms epoch), if solved. Used only for tiebreak. */
  solvedAtMs: number | null;
}

/** Score for a single problem in the match. */
export function problemScore(input: ProblemScoreInput): number {
  if (input.status !== 'SOLVED') return 0;
  const base = MATCH_CONFIG.points[input.difficulty];
  return Math.max(0, base - input.wrongSubmissions * MATCH_CONFIG.wrongSubmissionPenalty);
}

export interface PlayerTally {
  totalScore: number;
  /** Sum of (solve time - match start) across solved problems, in ms. Lower = faster. */
  totalSolveMs: number;
  solvedCount: number;
}

/** Roll up a player's three problem scores into a match tally. */
export function tallyPlayer(
  problems: ProblemScoreInput[],
  matchStartMs: number,
): PlayerTally {
  let totalScore = 0;
  let totalSolveMs = 0;
  let solvedCount = 0;
  for (const p of problems) {
    totalScore += problemScore(p);
    if (p.status === 'SOLVED' && p.solvedAtMs != null) {
      solvedCount++;
      totalSolveMs += Math.max(0, p.solvedAtMs - matchStartMs);
    }
  }
  return { totalScore, totalSolveMs, solvedCount };
}

export type MatchOutcome = 'A_WINS' | 'B_WINS' | 'DRAW';

/** Decide the outcome from two tallies. Tiebreak: fewer total solve ms wins. */
export function decideOutcome(a: PlayerTally, b: PlayerTally): MatchOutcome {
  if (a.totalScore !== b.totalScore) {
    return a.totalScore > b.totalScore ? 'A_WINS' : 'B_WINS';
  }
  // Same score. If both solved something, faster aggregate solve time wins.
  if (a.totalSolveMs !== b.totalSolveMs) {
    return a.totalSolveMs < b.totalSolveMs ? 'A_WINS' : 'B_WINS';
  }
  return 'DRAW';
}
