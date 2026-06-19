/**
 * Match lifecycle: creation, problem selection, and completion (scoring + ELO).
 *
 * Two modes:
 *   SPRINT      — 3 problems (2E + 1M), race to finish. Match ends when one
 *                 player solves all 3 or time runs out.
 *   PROGRESSIVE — 8 problems (3E + 3M + 2H), time-based. Match ends when
 *                 time runs out OR one player finishes all 8.
 *
 * Independent progression: both players progress through the same sequence
 * at their own pace.
 */

import { db, type Difficulty, type Prisma, type MatchMode } from '@zapdos/db';
import { updateRatings, type GameResult } from '@zapdos/elo';
import { MATCH_CONFIG, type MatchModeType, modeConfig } from './config';
import {
  decideOutcome,
  problemScore,
  tallyPlayer,
  type ProblemScoreInput,
} from './scoring';

/** Shuffle an array in place (Fisher-Yates). */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/** Pick a random difficulty: 50% EASY, 50% MEDIUM. Never HARD. */
function randomDifficulty(): 'EASY' | 'MEDIUM' {
  return Math.random() < 0.5 ? 'EASY' : 'MEDIUM';
}

/**
 * Pick problems for a match, avoiding ids either player has seen recently.
 * Each slot is randomly assigned EASY or MEDIUM difficulty.
 */
export async function pickProblemsForMatch(
  playerAId: string,
  playerBId: string,
  mode: MatchModeType = 'SPRINT',
): Promise<string[]> {
  const cfg = modeConfig(mode);

  // Problems either player saw in the last 20 matches — keeps replays fresh.
  const recent = await db.match.findMany({
    where: {
      OR: [
        { playerAId: { in: [playerAId, playerBId] } },
        { playerBId: { in: [playerAId, playerBId] } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { problemSequence: true },
  });
  const seen = new Set<string>();
  for (const m of recent) {
    for (const id of m.problemSequence) seen.add(id);
  }

  const pick = async (difficulty: 'EASY' | 'MEDIUM', exclude: Set<string>, matchUsed: Set<string>): Promise<string> => {
    // Fetch all candidates and pick one at random
    const candidates = await db.problem.findMany({
      where: { difficulty, isVisible: true, id: { notIn: [...exclude] } },
      select: { id: true },
    });
    if (candidates.length > 0) {
      const chosen = candidates[Math.floor(Math.random() * candidates.length)]!;
      exclude.add(chosen.id);
      matchUsed.add(chosen.id);
      return chosen.id;
    }
    // Fallback: ignore "seen" if we've exhausted the pool
    const fallbacks = await db.problem.findMany({
      where: { difficulty, isVisible: true, id: { notIn: [...matchUsed] } },
      select: { id: true },
    });
    if (fallbacks.length === 0) {
      // Last resort: try any difficulty
      const anyDifficulty = await db.problem.findMany({
        where: { isVisible: true, id: { notIn: [...matchUsed] } },
        select: { id: true },
      });
      if (anyDifficulty.length === 0) {
        throw new Error('No visible problems available for match creation');
      }
      const chosen = anyDifficulty[Math.floor(Math.random() * anyDifficulty.length)]!;
      matchUsed.add(chosen.id);
      return chosen.id;
    }
    const chosen = fallbacks[Math.floor(Math.random() * fallbacks.length)]!;
    exclude.add(chosen.id);
    matchUsed.add(chosen.id);
    return chosen.id;
  };

  const used = new Set(seen);
  const matchUsed = new Set<string>();
  const sequence: string[] = [];

  // Build difficulty list from mode composition instead of random assignment
  const difficulties: Array<'EASY' | 'MEDIUM'> = [];
  for (const slot of cfg.composition) {
    const diff = slot.difficulty === 'HARD' ? 'MEDIUM' : slot.difficulty;
    for (let i = 0; i < slot.count; i++) {
      difficulties.push(diff);
    }
  }

  for (let i = 0; i < cfg.totalProblems; i++) {
    const diff = difficulties[i] ?? 'EASY';
    sequence.push(await pick(diff, used, matchUsed));
  }

  return shuffle(sequence);
}

/**
 * Pick 3 problems for practice mode.
 * Uses the difficulty parameter to bias problem selection:
 * - EASY: 70% EASY, 30% MEDIUM
 * - MEDIUM: 30% EASY, 70% MEDIUM
 * - HARD: 0% EASY, 50% MEDIUM, 50% HARD (if HARD problems exist)
 */
async function pickPracticeProblems(
  playerAId: string,
  playerBId: string,
  difficulty: Difficulty,
): Promise<string[]> {
  const recent = await db.match.findMany({
    where: {
      OR: [
        { playerAId: { in: [playerAId, playerBId] } },
        { playerBId: { in: [playerAId, playerBId] } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { problemSequence: true },
  });
  const seen = new Set<string>();
  for (const m of recent) {
    for (const id of m.problemSequence) seen.add(id);
  }

  const used = new Set(seen);
  const matchUsed = new Set<string>();
  const sequence: string[] = [];

  // Build difficulty distribution based on requested difficulty
  const difficulties: Array<'EASY' | 'MEDIUM' | 'HARD'> = [];
  if (difficulty === 'EASY') {
    // 70% EASY, 30% MEDIUM
    difficulties.push('EASY', 'EASY', 'MEDIUM');
  } else if (difficulty === 'MEDIUM') {
    // 30% EASY, 70% MEDIUM
    difficulties.push('EASY', 'MEDIUM', 'MEDIUM');
  } else {
    // HARD: 0% EASY, 50% MEDIUM, 50% HARD
    difficulties.push('MEDIUM', 'MEDIUM', 'HARD');
  }
  shuffle(difficulties);

  for (let i = 0; i < 3; i++) {
    let diff = difficulties[i] ?? 'MEDIUM';

    // Fallback: if HARD problems don't exist, use MEDIUM
    if (diff === 'HARD') {
      const hardCount = await db.problem.count({ where: { difficulty: 'HARD', isVisible: true } });
      if (hardCount === 0) diff = 'MEDIUM';
    }

    const candidates = await db.problem.findMany({
      where: { difficulty: diff, isVisible: true, id: { notIn: [...used] } },
      select: { id: true },
    });
    if (candidates.length > 0) {
      const chosen = candidates[Math.floor(Math.random() * candidates.length)]!;
      used.add(chosen.id);
      matchUsed.add(chosen.id);
      sequence.push(chosen.id);
    } else {
      // Fallback: try any difficulty
      const fallbacks = await db.problem.findMany({
        where: { isVisible: true, id: { notIn: [...matchUsed] } },
        select: { id: true },
      });
      if (fallbacks.length === 0) throw new Error('No visible problems available');
      const chosen = fallbacks[Math.floor(Math.random() * fallbacks.length)]!;
      matchUsed.add(chosen.id);
      sequence.push(chosen.id);
    }
  }

  return shuffle(sequence);
}

/** Create an in-progress match between two players. */
export async function createMatch(
  playerAId: string,
  playerBId: string,
  mode: MatchModeType = 'SPRINT',
  practiceDifficulty?: Difficulty,
): Promise<string> {
  const cfg = modeConfig(mode);
  const problemSequence = practiceDifficulty
    ? await pickPracticeProblems(playerAId, playerBId, practiceDifficulty)
    : await pickProblemsForMatch(playerAId, playerBId, mode);
  const now = new Date();
  const ends = new Date(now.getTime() + cfg.durationSeconds * 1000);

  // Build MatchProgress rows: first problem UNLOCKED, rest LOCKED.
  const progressRows: Array<{
    userId: string;
    problemId: string;
    problemOrder: number;
    status: 'UNLOCKED' | 'LOCKED';
    unlockedAt?: Date;
  }> = [];
  for (const userId of [playerAId, playerBId]) {
    for (let i = 0; i < problemSequence.length; i++) {
      progressRows.push({
        userId,
        problemId: problemSequence[i]!,
        problemOrder: i,
        status: i === 0 ? ('UNLOCKED' as const) : ('LOCKED' as const),
        unlockedAt: i === 0 ? now : undefined,
      });
    }
  }

  const match = await db.$transaction(async (tx) => {
    const m = await tx.match.create({
      data: {
        playerAId,
        playerBId,
        mode: mode as MatchMode,
        problemSequence,
        totalProblems: cfg.totalProblems,
        status: 'IN_PROGRESS',
        startsAt: now,
        endsAt: ends,
        durationSec: cfg.durationSeconds,
        progress: { create: progressRows },
      },
    });
    return m;
  });

  return match.id;
}

export interface FinalizeInput {
  matchId: string;
  reason: 'time' | 'both_solved' | 'forfeit' | 'disconnect' | 'cancelled' | 'early_finish';
  /** When forfeit/disconnect: the user who did NOT forfeit wins. */
  forfeiterId?: string;
}

export interface FinalizeResult {
  matchId: string;
  winnerId: string | null;
  outcome: 'A_WINS' | 'B_WINS' | 'DRAW';
  scoreA: number;
  scoreB: number;
  eloDeltaA: number;
  eloDeltaB: number;
}

/**
 * Finalize a match: compute scores, decide winner, update ELO, mark COMPLETED.
 * Idempotent-ish: if the match is already COMPLETED we no-op and return prior.
 */
export async function finalizeMatch(input: FinalizeInput): Promise<FinalizeResult> {
  return db.$transaction(async (tx) => {
    // SELECT FOR UPDATE — lock the match row to prevent double-finalization
    // from concurrent timer and client triggers.
    const match = await tx.$queryRaw<
      Array<{
        id: string;
        playerAId: string;
        playerBId: string;
        mode: string;
        status: string;
        winnerId: string | null;
        scoreA: number;
        scoreB: number;
        eloDeltaA: number;
        eloDeltaB: number;
        startsAt: Date | null;
        endsAt: Date | null;
        problemSequence: string[];
        isPractice: boolean;
      }>
    >`SELECT * FROM "Match" WHERE "id" = ${input.matchId} FOR UPDATE`;

    const matchRow = match[0];
    if (!matchRow) throw new Error(`Match ${input.matchId} not found`);
    if (matchRow.status === 'COMPLETED' || matchRow.status === 'CANCELLED') {
      return {
        matchId: matchRow.id,
        winnerId: matchRow.winnerId,
        outcome:
          matchRow.winnerId === matchRow.playerAId
            ? 'A_WINS'
            : matchRow.winnerId === matchRow.playerBId
              ? 'B_WINS'
              : 'DRAW',
        scoreA: matchRow.scoreA,
        scoreB: matchRow.scoreB,
        eloDeltaA: matchRow.eloDeltaA,
        eloDeltaB: matchRow.eloDeltaB,
      };
    }

    // Fetch full player data for ELO calculation — lock both rows to prevent
    // concurrent finalizations from overwriting each other's ELO updates.
    const [playerARows, playerBRows] = await Promise.all([
      tx.$queryRaw<Array<{ elo: number; gamesPlayed: number }>>`SELECT elo, "gamesPlayed" FROM "User" WHERE id = ${matchRow.playerAId} FOR UPDATE`,
      tx.$queryRaw<Array<{ elo: number; gamesPlayed: number }>>`SELECT elo, "gamesPlayed" FROM "User" WHERE id = ${matchRow.playerBId} FOR UPDATE`,
    ]);
    const playerA = playerARows[0];
    const playerB = playerBRows[0];

    const mode = matchRow.mode as MatchModeType;
    const startMs = matchRow.startsAt ? matchRow.startsAt.getTime() : Date.now();

    // Build difficulty lookup from problemSequence
    const problemIds = matchRow.problemSequence;
    const problems = await tx.problem.findMany({
      where: { id: { in: problemIds } },
      select: { id: true, difficulty: true, points: true },
    });
    const difficultyMap = new Map(problems.map((p) => [p.id, p]));

    // Fetch progress rows for both players
    const allProgress = await tx.matchProgress.findMany({
      where: { matchId: input.matchId },
    });

    const toInputs = (userId: string): ProblemScoreInput[] => {
      const rows = allProgress.filter((p) => p.userId === userId);
      return rows
        .sort((a, b) => a.problemOrder - b.problemOrder)
        .map((row) => {
          const prob = difficultyMap.get(row.problemId);
          return {
            difficulty: (prob?.difficulty ?? 'EASY') as Difficulty,
            status: row.status,
            wrongSubmissions: row.wrongSubmissions,
            solvedAtMs: row.solvedAt ? row.solvedAt.getTime() : null,
            points: prob?.points ?? 100,
          };
        });
    };

    // Write per-problem scoreEarned for both players.
    for (const userId of [matchRow.playerAId, matchRow.playerBId]) {
      const inputs = toInputs(userId);
      const userProgress = allProgress.filter((p) => p.userId === userId);
      for (let i = 0; i < inputs.length; i++) {
        const earned = problemScore(inputs[i]!);
        const progRow = userProgress.find((p) => p.problemOrder === i);
        if (progRow) {
          await tx.matchProgress.update({
            where: { id: progRow.id },
            data: { scoreEarned: earned },
          });
        }
      }
    }

    const tallyA = tallyPlayer(toInputs(matchRow.playerAId), startMs);
    const tallyB = tallyPlayer(toInputs(matchRow.playerBId), startMs);

    let outcome = decideOutcome(tallyA, tallyB, mode);

    // Forfeit overrides: the non-forfeiter wins regardless of score.
    if (input.reason === 'forfeit' || input.reason === 'disconnect') {
      if (input.forfeiterId === matchRow.playerAId) outcome = 'B_WINS';
      else if (input.forfeiterId === matchRow.playerBId) outcome = 'A_WINS';
    }

    const winnerId =
      outcome === 'A_WINS'
        ? matchRow.playerAId
        : outcome === 'B_WINS'
          ? matchRow.playerBId
          : null;

    // ELO — skip for practice matches (no rating impact)
    let eloDeltaA = 0;
    let eloDeltaB = 0;

    if (!matchRow.isPractice) {
      const resultFromA: GameResult =
        outcome === 'A_WINS' ? 'win' : outcome === 'B_WINS' ? 'loss' : 'draw';
      const elo = updateRatings(
        resultFromA,
        playerA?.elo ?? 1200,
        playerB?.elo ?? 1200,
        playerA?.gamesPlayed ?? 0,
        playerB?.gamesPlayed ?? 0,
      );

      eloDeltaA = elo.deltaA;
      eloDeltaB = elo.deltaB;

      const applyUserRecord = async (
        userId: string,
        newElo: number,
        won: boolean | null,
      ) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            elo: newElo,
            gamesPlayed: { increment: 1 },
            wins: { increment: won === true ? 1 : 0 },
            losses: { increment: won === false ? 1 : 0 },
            draws: { increment: won === null ? 1 : 0 },
          },
        });
      };

      await applyUserRecord(
        matchRow.playerAId,
        elo.ratingA,
        outcome === 'DRAW' ? null : outcome === 'A_WINS',
      );
      await applyUserRecord(
        matchRow.playerBId,
        elo.ratingB,
        outcome === 'DRAW' ? null : outcome === 'B_WINS',
      );
    }

    await tx.match.update({
      where: { id: matchRow.id },
      data: {
        status: 'COMPLETED',
        endsAt: matchRow.endsAt ?? new Date(),
        winnerId,
        scoreA: tallyA.totalScore,
        scoreB: tallyB.totalScore,
        eloDeltaA,
        eloDeltaB,
        endReason: input.reason,
      },
    });

    return {
      matchId: matchRow.id,
      winnerId,
      outcome,
      scoreA: tallyA.totalScore,
      scoreB: tallyB.totalScore,
      eloDeltaA,
      eloDeltaB,
    };
  });
}

/** Helper for callers that just need the typed Prisma transaction. */
export type { Prisma };
