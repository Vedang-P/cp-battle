/**
 * Shared constants for the AI practice bot.
 * Used by the practice API route and the bot worker.
 *
 * Bot is designed to be beatable — takes ~5-6 min per problem in a 20-min duel.
 * Multiple wrong submissions, occasional "getting stuck", and timing jitter
 * make the bot feel like a real (but not great) human player.
 */

/** The bot user's email — used to look up or create the bot user. */
export const BOT_EMAIL = 'zap-bot@zapdos.dev';

/** Bot username displayed in matches. */
export const BOT_USERNAME = 'Zapdos-Bot';

/**
 * Difficulty profiles for the AI opponent.
 *
 * solveMs: [min, max] — random base delay before solving (ms).
 *   Actual delay = base × problemDifficultyMultiplier ± timingJitter.
 * wrongChance: probability of a wrong submission before the correct one.
 * wrongDelay: [min, max] — delay before the wrong submission (ms).
 * maxWrongSubmissions: cap on wrong attempts before auto-solving.
 * stuckChance: probability of "getting stuck" (adds extra delay).
 * stuckDelay: [min, max] — extra delay when stuck (ms).
 * timingJitter: ±percentage jitter applied to all delays (0.20 = ±20%).
 */
export interface BotProfile {
  solveMs: [number, number];
  wrongChance: number;
  wrongDelay: [number, number];
  maxWrongSubmissions: number;
  stuckChance: number;
  stuckDelay: [number, number];
  timingJitter: number;
}

export const BOT_PROFILES: Record<string, BotProfile> = {
  EASY: {
    solveMs: [240_000, 360_000],       // 4-6 min base
    wrongChance: 0.35,                  // 35% chance of wrong submission
    wrongDelay: [15_000, 30_000],       // 15-30s before wrong
    maxWrongSubmissions: 2,             // up to 2 wrong attempts
    stuckChance: 0.10,                  // 10% chance of getting stuck
    stuckDelay: [30_000, 60_000],       // 30-60s extra when stuck
    timingJitter: 0.20,                 // ±20%
  },
  MEDIUM: {
    solveMs: [240_000, 360_000],       // 4-6 min base
    wrongChance: 0.25,                  // 25% chance of wrong submission
    wrongDelay: [10_000, 25_000],       // 10-25s before wrong
    maxWrongSubmissions: 3,             // up to 3 wrong attempts
    stuckChance: 0.08,                  // 8% chance of getting stuck
    stuckDelay: [45_000, 90_000],       // 45-90s extra when stuck
    timingJitter: 0.20,                 // ±20%
  },
  HARD: {
    solveMs: [240_000, 360_000],       // 4-6 min base
    wrongChance: 0.15,                  // 15% chance of wrong submission
    wrongDelay: [10_000, 20_000],       // 10-20s before wrong
    maxWrongSubmissions: 1,             // up to 1 wrong attempt
    stuckChance: 0.05,                  // 5% chance of getting stuck
    stuckDelay: [60_000, 120_000],      // 60-120s extra when stuck
    timingJitter: 0.15,                 // ±15%
  },
};

/**
 * Problem difficulty multipliers applied to the base solve delay.
 * Bot is slower on harder problems but not impossibly so.
 */
const PROBLEM_MULTIPLIERS: Record<string, number> = {
  EASY: 1,
  MEDIUM: 1.5,
  HARD: 2,
};

/**
 * Get the solve delay for a problem given the bot's difficulty profile.
 * Applies: base × problemMultiplier ± jitter.
 */
export function getSolveDelay(profile: BotProfile, problemDifficulty: string): number {
  const [min, max] = profile.solveMs;
  const base = min + Math.random() * (max - min);
  const multiplier = PROBLEM_MULTIPLIERS[problemDifficulty] ?? 1;
  const jitter = 1 + (Math.random() * 2 - 1) * profile.timingJitter;
  return Math.round(base * multiplier * jitter);
}

/**
 * Apply timing jitter to a delay value.
 */
export function applyJitter(delay: number, jitter: number): number {
  const factor = 1 + (Math.random() * 2 - 1) * jitter;
  return Math.round(delay * factor);
}

/** Random integer in [min, max] inclusive. */
export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
