/**
 * Shared constants for the AI practice bot.
 * Used by the practice API route and the bot worker.
 */

/** The bot user's email — used to look up or create the bot user. */
export const BOT_EMAIL = 'zap-bot@zapdos.dev';

/** Bot username displayed in matches. */
export const BOT_USERNAME = 'Zapdos-Bot';

/**
 * Difficulty profiles for the AI opponent.
 *
 * solveMs: [min, max] — random delay before solving a problem of EASY difficulty.
 *   MEDIUM problems take 2.5x, HARD problems take 4x.
 * wrongChance: probability of a wrong submission before the correct one.
 * wrongDelay: [min, max] — delay before the wrong submission (ms).
 */
export interface BotProfile {
  solveMs: [number, number];
  wrongChance: number;
  wrongDelay: [number, number];
}

export const BOT_PROFILES: Record<string, BotProfile> = {
  EASY: {
    solveMs: [60_000, 90_000],
    wrongChance: 0.3,
    wrongDelay: [5_000, 10_000],
  },
  MEDIUM: {
    solveMs: [20_000, 40_000],
    wrongChance: 0.15,
    wrongDelay: [3_000, 6_000],
  },
  HARD: {
    solveMs: [5_000, 15_000],
    wrongChance: 0,
    wrongDelay: [0, 0],
  },
};

/**
 * Get the solve delay for a problem given the bot's difficulty profile.
 * Adjusts based on the problem's actual difficulty.
 */
export function getSolveDelay(profile: BotProfile, problemDifficulty: string): number {
  const [min, max] = profile.solveMs;
  const base = min + Math.random() * (max - min);

  // Multiply based on problem difficulty relative to the bot's level
  const multiplier =
    problemDifficulty === 'HARD' ? 4 :
    problemDifficulty === 'MEDIUM' ? 2.5 :
    1;

  return Math.round(base * multiplier);
}

/** Random integer in [min, max] inclusive. */
export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
