/**
 * @zapdos/elo — Classic Elo rating math for 1v1 matches.
 *
 * Pure functions, zero dependencies. Tunable via EloConfig.
 *
 * Standard Elo:
 *   E_A = 1 / (1 + 10^((R_B - R_A) / 400))
 *   R_A' = R_A + K * (S_A - E_A)
 * where S is the actual score (1 win / 0.5 draw / 0 loss).
 *
 * We use a K-factor that scales down once a player has played enough games,
 * which keeps new players' ratings volatile and stabilises veterans.
 */

export type GameResult = 'win' | 'loss' | 'draw';

/** Map a result from player A's perspective to the standard 1 / 0.5 / 0 score. */
export const scoreForResult = (result: GameResult): number =>
  result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;

export interface EloConfig {
  /** Default rating for a brand-new account. */
  defaultRating: number;
  /** K-factor used while a player has fewer than `provisionalGames` games. */
  kProvisional: number;
  /** K-factor once a player is established. */
  kEstablished: number;
  /** Number of games before a player leaves "provisional" status. */
  provisionalGames: number;
}

export const DEFAULT_ELO_CONFIG: EloConfig = {
  defaultRating: 1200,
  kProvisional: 40,
  kEstablished: 32,
  provisionalGames: 10,
};

/** Pick the K-factor for a player given how many games they've already played. */
export function kFactor(gamesPlayed: number, config: EloConfig = DEFAULT_ELO_CONFIG): number {
  return gamesPlayed < config.provisionalGames ? config.kProvisional : config.kEstablished;
}

/** Expected score for player A against player B (0..1). */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export interface EloUpdate {
  /** New rating for player A. */
  ratingA: number;
  /** New rating for player B. */
  ratingB: number;
  /** Signed delta applied to A (negative = lost rating). */
  deltaA: number;
  /** Signed delta applied to B (always the negation of deltaA). */
  deltaB: number;
}

/**
 * Compute the new ratings after a 1v1 match.
 *
 * @param resultFromA  Result from A's perspective ('win' | 'loss' | 'draw').
 * @param ratingA      A's current rating.
 * @param ratingB      B's current rating.
 * @param gamesA       A's games played *before* this match.
 * @param gamesB       B's games played *before* this match.
 */
export function updateRatings(
  resultFromA: GameResult,
  ratingA: number,
  ratingB: number,
  gamesA: number,
  gamesB: number,
  config: EloConfig = DEFAULT_ELO_CONFIG,
): EloUpdate {
  const kA = kFactor(gamesA, config);
  const kB = kFactor(gamesB, config);
  const eA = expectedScore(ratingA, ratingB);
  const eB = 1 - eA;
  const sA = scoreForResult(resultFromA);
  const sB = 1 - sA;

  // Each player gets their own K-factor delta independently.
  // We do NOT force zero-sum normalization — this keeps the rating system
  // honest: provisional players can gain more than veterans lose, and vice versa.
  const deltaA = kA * (sA - eA);
  const deltaB = kB * (sB - eB);

  return {
    ratingA: Math.round(ratingA + deltaA),
    ratingB: Math.round(ratingB + deltaB),
    deltaA: Math.round(deltaA),
    deltaB: Math.round(deltaB),
  };
}
