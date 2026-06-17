/**
 * Match lifecycle: creation, problem selection, and completion (scoring + ELO).
 *
 * These functions talk to Prisma directly and are the single source of truth
 * for mutating Match + MatchProgress rows. The realtime server calls into
 * here when a match ends.
 */

import { db, type Difficulty, type Prisma } from '@cp-battle/db';
import { updateRatings, type GameResult } from '@cp-battle/elo';
import { MATCH_CONFIG } from './config.js';
import {
  decideOutcome,
  problemScore,
  tallyPlayer,
  type ProblemScoreInput,
} from './scoring.js';

/** Pick one problem per difficulty, avoiding ids the player has seen recently. */
export async function pickProblemsForMatch(
  playerAId: string,
  playerBId: string,
): Promise<{ easy: string; medium: string; hard: string }> {
  // Problems either player saw in the last 20 matches — keeps replays fresh.
  const recent = await db.match.findMany({
    where: { OR: [{ playerAId: { in: [playerAId, playerBId] } }, { playerBId: { in: [playerAId, playerBId] } }] },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { easyId: true, mediumId: true, hardId: true },
  });
  const seen = new Set<string>();
  for (const m of recent) {
    seen.add(m.easyId);
    seen.add(m.mediumId);
    seen.add(m.hardId);
  }

  const pick = async (difficulty: Difficulty): Promise<string> => {
    const candidate = await db.problem.findFirst({
      where: { difficulty, isVisible: true, id: { notIn: [...seen] } },
      orderBy: { createdAt: 'asc' }, // rotate through oldest first
    });
    if (candidate) {
      seen.add(candidate.id);
      return candidate.id;
    }
    // Fallback: ignore "seen" if we've exhausted the pool.
    const fallback = await db.problem.findFirst({
      where: { difficulty, isVisible: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!fallback) throw new Error(`No visible ${difficulty} problem available to seed match`);
    seen.add(fallback.id);
    return fallback.id;
  };

  const [easy, medium, hard] = await Promise.all([
    pick('EASY'),
    pick('MEDIUM'),
    pick('HARD'),
  ]);
  return { easy, medium, hard };
}

/** Create an in-progress match between two players. */
export async function createMatch(playerAId: string, playerBId: string): Promise<string> {
  const problems = await pickProblemsForMatch(playerAId, playerBId);
  const now = new Date();
  const ends = new Date(now.getTime() + MATCH_CONFIG.durationSeconds * 1000);

  // One transaction: create match + 6 MatchProgress rows (3 per player).
  const match = await db.$transaction(async (tx) => {
    const m = await tx.match.create({
      data: {
        playerAId,
        playerBId,
        easyId: problems.easy,
        mediumId: problems.medium,
        hardId: problems.hard,
        status: 'IN_PROGRESS',
        startsAt: now,
        endsAt: ends,
        durationSec: MATCH_CONFIG.durationSeconds,
        progress: {
          create: [
            // Player A: easy unlocked, medium/hard locked.
            { userId: playerAId, problemId: problems.easy, difficulty: 'EASY', status: 'UNLOCKED', unlockedAt: now },
            { userId: playerAId, problemId: problems.medium, difficulty: 'MEDIUM', status: 'LOCKED' },
            { userId: playerAId, problemId: problems.hard, difficulty: 'HARD', status: 'LOCKED' },
            // Player B: same.
            { userId: playerBId, problemId: problems.easy, difficulty: 'EASY', status: 'UNLOCKED', unlockedAt: now },
            { userId: playerBId, problemId: problems.medium, difficulty: 'MEDIUM', status: 'LOCKED' },
            { userId: playerBId, problemId: problems.hard, difficulty: 'HARD', status: 'LOCKED' },
          ],
        },
      },
      include: { progress: true },
    });
    return m;
  });

  return match.id;
}

export interface FinalizeInput {
  matchId: string;
  reason: 'time' | 'both_solved' | 'forfeit' | 'disconnect' | 'cancelled';
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

    const startMs = match.startsAt ? match.startsAt.getTime() : Date.now();

    const toInputs = (userId: string): ProblemScoreInput[] => {
      const rows = match.progress.filter((p) => p.userId === userId);
      const difficulties: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];
      return difficulties.map((d) => {
        const row = rows.find((r) => r.difficulty === d);
        return {
          difficulty: d,
          status: row?.status ?? 'LOCKED',
          wrongSubmissions: row?.wrongSubmissions ?? 0,
          solvedAtMs: row?.solvedAt ? row.solvedAt.getTime() : null,
        };
      });
    };

    // Write per-problem scoreEarned for both players (for history detail).
    for (const userId of [match.playerAId, match.playerBId]) {
      const inputs = toInputs(userId);
      for (const inp of inputs) {
        const earned = problemScore(inp);
        await tx.matchProgress.updateMany({
          where: { matchId: match.id, userId, difficulty: inp.difficulty },
          data: { scoreEarned: earned },
        });
      }
    }

    const tallyA = tallyPlayer(toInputs(match.playerAId), startMs);
    const tallyB = tallyPlayer(toInputs(match.playerBId), startMs);

    let outcome = decideOutcome(tallyA, tallyB);
    // Forfeit overrides: the non-forfeiter wins regardless of score.
    if (input.reason === 'forfeit' || input.reason === 'disconnect') {
      if (input.forfeiterId === match.playerAId) outcome = 'B_WINS';
      else if (input.forfeiterId === match.playerBId) outcome = 'A_WINS';
    }

    const winnerId =
      outcome === 'A_WINS' ? match.playerAId : outcome === 'B_WINS' ? match.playerBId : null;

    // ELO. resultFromA derived from outcome.
    const resultFromA: GameResult =
      outcome === 'A_WINS' ? 'win' : outcome === 'B_WINS' ? 'loss' : 'draw';
    const elo = updateRatings(
      resultFromA,
      match.playerA.elo,
      match.playerB.elo,
      match.playerA.gamesPlayed,
      match.playerB.gamesPlayed,
    );

    // Persist match + user rating/record changes together.
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
      won: boolean | null, // null = draw
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

    await applyUserRecord(match.playerAId, elo.ratingA, outcome === 'A_WINS', match.playerA.gamesPlayed);
    await applyUserRecord(match.playerBId, elo.ratingB, outcome === 'B_WINS', match.playerB.gamesPlayed);

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
