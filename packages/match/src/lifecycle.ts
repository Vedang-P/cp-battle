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

import { db, type Difficulty, type Prisma, type MatchMode } from '@cp-battle/db';
import { updateRatings, type GameResult } from '@cp-battle/elo';
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

/**
 * Pick problems for a match, avoiding ids either player has seen recently.
 * Returns an ordered list of problem IDs matching the mode's composition.
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

  const pick = async (difficulty: Difficulty, exclude: Set<string>): Promise<string> => {
    const candidate = await db.problem.findFirst({
      where: { difficulty, isVisible: true, id: { notIn: [...exclude] } },
      orderBy: { createdAt: 'asc' },
    });
    if (candidate) {
      exclude.add(candidate.id);
      return candidate.id;
    }
    // Fallback: ignore "seen" if we've exhausted the pool.
    const fallback = await db.problem.findFirst({
      where: { difficulty, isVisible: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!fallback) throw new Error(`No visible ${difficulty} problem available`);
    exclude.add(fallback.id);
    return fallback.id;
  };

  const sequence: string[] = [];
  const used = new Set(seen);

  for (const tier of cfg.composition) {
    for (let i = 0; i < tier.count; i++) {
      sequence.push(await pick(tier.difficulty, used));
    }
  }

  // Shuffle within the sequence so difficulty order varies.
  // But keep the general tier structure (all easies before mediums, etc.)
  // by shuffling within contiguous blocks of the same difficulty.
  const blocks: string[][] = [];
  let currentBlock: string[] = [];
  let currentDiff = cfg.composition[0]!.difficulty;
  for (const id of sequence) {
    const prob = await db.problem.findUnique({ where: { id }, select: { difficulty: true } });
    if (prob?.difficulty !== currentDiff) {
      if (currentBlock.length > 0) blocks.push(currentBlock);
      currentBlock = [id];
      currentDiff = prob?.difficulty ?? currentDiff;
    } else {
      currentBlock.push(id);
    }
  }
  if (currentBlock.length > 0) blocks.push(currentBlock);

  const result: string[] = [];
  for (const block of blocks) {
    result.push(...shuffle(block));
  }
  return result;
}

/** Create an in-progress match between two players. */
export async function createMatch(
  playerAId: string,
  playerBId: string,
  mode: MatchModeType = 'SPRINT',
): Promise<string> {
  const cfg = modeConfig(mode);
  const problemSequence = await pickProblemsForMatch(playerAId, playerBId, mode);
  const now = new Date();
  const ends = new Date(now.getTime() + cfg.durationSeconds * 1000);

  // Build MatchProgress rows: first problem UNLOCKED, rest LOCKED.
  const progressRows = [];
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
    const match = await tx.match.findUnique({
      where: { id: input.matchId },
      include: { progress: true, playerA: true, playerB: true },
    });
    if (!match) throw new Error(`Match ${input.matchId} not found`);
    if (match.status === 'COMPLETED' || match.status === 'CANCELLED') {
      return {
        matchId: match.id,
        winnerId: match.winnerId,
        outcome:
          match.winnerId === match.playerAId
            ? 'A_WINS'
            : match.winnerId === match.playerBId
              ? 'B_WINS'
              : 'DRAW',
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        eloDeltaA: match.eloDeltaA,
        eloDeltaB: match.eloDeltaB,
      };
    }

    const mode = match.mode as MatchModeType;
    const startMs = match.startsAt ? match.startsAt.getTime() : Date.now();

    // Build difficulty lookup from problemSequence
    const problemIds = match.problemSequence;
    const problems = await tx.problem.findMany({
      where: { id: { in: problemIds } },
      select: { id: true, difficulty: true },
    });
    const difficultyMap = new Map(problems.map((p) => [p.id, p.difficulty]));

    const toInputs = (userId: string): ProblemScoreInput[] => {
      const rows = match.progress.filter((p) => p.userId === userId);
      return rows
        .sort((a, b) => a.problemOrder - b.problemOrder)
        .map((row) => ({
          difficulty: difficultyMap.get(row.problemId) as Difficulty,
          status: row.status,
          wrongSubmissions: row.wrongSubmissions,
          solvedAtMs: row.solvedAt ? row.solvedAt.getTime() : null,
        }));
    };

    // Write per-problem scoreEarned for both players.
    for (const userId of [match.playerAId, match.playerBId]) {
      const inputs = toInputs(userId);
      const userProgress = match.progress.filter((p) => p.userId === userId);
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

    const tallyA = tallyPlayer(toInputs(match.playerAId), startMs);
    const tallyB = tallyPlayer(toInputs(match.playerBId), startMs);

    let outcome = decideOutcome(tallyA, tallyB, mode);

    // Forfeit overrides: the non-forfeiter wins regardless of score.
    if (input.reason === 'forfeit' || input.reason === 'disconnect') {
      if (input.forfeiterId === match.playerAId) outcome = 'B_WINS';
      else if (input.forfeiterId === match.playerBId) outcome = 'A_WINS';
    }

    const winnerId =
      outcome === 'A_WINS'
        ? match.playerAId
        : outcome === 'B_WINS'
          ? match.playerBId
          : null;

    // ELO
    const resultFromA: GameResult =
      outcome === 'A_WINS' ? 'win' : outcome === 'B_WINS' ? 'loss' : 'draw';
    const elo = updateRatings(
      resultFromA,
      match.playerA.elo,
      match.playerB.elo,
      match.playerA.gamesPlayed,
      match.playerB.gamesPlayed,
    );

    await tx.match.update({
      where: { id: match.id },
      data: {
        status: 'COMPLETED',
        endsAt: match.endsAt ?? new Date(),
        winnerId,
        scoreA: tallyA.totalScore,
        scoreB: tallyB.totalScore,
        eloDeltaA: elo.deltaA,
        eloDeltaB: elo.deltaB,
        endReason: input.reason,
      },
    });

    const applyUserRecord = async (
      userId: string,
      newElo: number,
      won: boolean | null,
      gamesBefore: number,
    ) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          elo: newElo,
          gamesPlayed: gamesBefore + 1,
          wins: { increment: won === true ? 1 : 0 },
          losses: { increment: won === false ? 1 : 0 },
          draws: { increment: won === null ? 1 : 0 },
        },
      });
    };

    await applyUserRecord(
      match.playerAId,
      elo.ratingA,
      outcome === 'DRAW' ? null : outcome === 'A_WINS',
      match.playerA.gamesPlayed,
    );
    await applyUserRecord(
      match.playerBId,
      elo.ratingB,
      outcome === 'DRAW' ? null : outcome === 'B_WINS',
      match.playerB.gamesPlayed,
    );

    return {
      matchId: match.id,
      winnerId,
      outcome,
      scoreA: tallyA.totalScore,
      scoreB: tallyB.totalScore,
      eloDeltaA: elo.deltaA,
      eloDeltaB: elo.deltaB,
    };
  });
}

/** Helper for callers that just need the typed Prisma transaction. */
export type { Prisma };
