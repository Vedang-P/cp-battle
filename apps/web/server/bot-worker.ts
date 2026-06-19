/**
 * Bot worker — processes AI practice matches.
 *
 * Polls for practice matches where the bot is playerB and schedules
 * simulated submissions based on difficulty profiles.
 *
 * Runs as a separate process: pnpm dev:bot
 */

import { db } from '@zapdos/db';
import { finalizeMatch } from '@zapdos/match';
import { BOT_EMAIL, BOT_PROFILES, getSolveDelay, randInt } from '../lib/bot-config';
import { emitSocketEvent } from '../lib/socket';
import { matchRoom } from '@zapdos/realtime';
import type { SubmissionVerdictPayload, OpponentSnapshot, MatchEndPayload } from '@zapdos/realtime';

const POLL_INTERVAL_MS = 2000;

/** Track which problems we've already scheduled to avoid duplicate submissions. */
const processedSubmissions = new Set<string>(); // `${matchId}:${problemOrder}`

/** Track scheduled timers so we can clean up on match end. */
const scheduledTimers = new Map<string, NodeJS.Timeout[]>(); // matchId -> timers

async function emitToMatch(matchId: string, event: string, payload: unknown) {
  return emitSocketEvent(matchRoom(matchId), event, payload);
}

async function emitToUser(userId: string, event: string, payload: unknown) {
  return emitSocketEvent(`user:${userId}`, event, payload);
}

/**
 * Build an OpponentSnapshot for a player in a match.
 */
async function buildSnapshot(matchId: string, userId: string, totalProblems: number): Promise<OpponentSnapshot> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, username: true } });
  const progress = await db.matchProgress.findMany({
    where: { matchId, userId },
    orderBy: { problemOrder: 'asc' },
  });
  const solvedCount = progress.filter((p) => p.status === 'SOLVED').length;
  const score = progress.reduce((sum, p) => sum + p.scoreEarned, 0);

  return {
    userId,
    username: user?.username ?? 'Unknown',
    score,
    problems: progress.map((p) => ({
      problemOrder: p.problemOrder,
      status: p.status as 'LOCKED' | 'UNLOCKED' | 'SOLVED',
      passed: null,
      total: null,
      wrongSubmissions: p.wrongSubmissions,
    })),
    raceProgress: totalProblems > 0 ? solvedCount / totalProblems : 0,
    solvedCount,
    totalProblems,
  };
}

/**
 * Schedule a bot submission for a problem.
 * Creates a real Submission record and updates MatchProgress.
 */
async function scheduleBotSubmission(
  matchId: string,
  botUserId: string,
  humanUserId: string,
  problemId: string,
  problemOrder: number,
  problemDifficulty: string,
  matchTotalProblems: number,
  difficulty: string,
) {
  const key = `${matchId}:${problemOrder}`;
  if (processedSubmissions.has(key)) return;
  processedSubmissions.add(key);

  const profile = BOT_PROFILES[difficulty] ?? BOT_PROFILES.MEDIUM!;

  // Schedule wrong submission (if applicable)
  const hasWrong = Math.random() < profile.wrongChance;
  const wrongDelay = hasWrong ? randInt(profile.wrongDelay[0], profile.wrongDelay[1]) : 0;
  const solveDelay = getSolveDelay(profile, problemDifficulty);

  const timers: NodeJS.Timeout[] = [];

  if (hasWrong) {
    const timer = setTimeout(async () => {
      try {
        // Check match is still in progress
        const match = await db.match.findUnique({ where: { id: matchId }, select: { status: true } });
        if (!match || match.status !== 'IN_PROGRESS') return;

        // Create wrong submission
        const submission = await db.submission.create({
          data: {
            matchId,
            userId: botUserId,
            problemId,
            language: 'cpp',
            code: '// AI wrong attempt',
            mode: 'SUBMIT',
            verdict: 'WA',
            passed: 0,
            total: 1,
          },
        });

        // Increment wrong submissions on progress
        const progress = await db.matchProgress.findFirst({
          where: { matchId, userId: botUserId, problemId },
        });
        if (progress) {
          await db.matchProgress.update({
            where: { id: progress.id },
            data: { wrongSubmissions: { increment: 1 } },
          });
        }

        // Emit verdict
        const verdictPayload: SubmissionVerdictPayload = {
          matchId,
          submissionId: submission.id,
          userId: botUserId,
          problemId,
          problemOrder,
          verdict: 'WA',
          passed: 0,
          total: 1,
          timeMs: null,
          memoryKb: null,
        };
        await emitToMatch(matchId, 'submission:verdict', verdictPayload);

        // Emit opponent progress
        const botSnapshot = await buildSnapshot(matchId, botUserId, matchTotalProblems);
        const humanSnapshot = await buildSnapshot(matchId, humanUserId, matchTotalProblems);
        await emitToMatch(matchId, 'opponent:progress', botSnapshot);
        await emitToMatch(matchId, 'opponent:progress', humanSnapshot);

        console.log(`[bot] Wrong submission for ${matchId} problem ${problemOrder}`);
      } catch (err) {
        console.error(`[bot] Error in wrong submission:`, err);
      }
    }, wrongDelay);
    timers.push(timer);
  }

  // Schedule correct submission
  const correctTimer = setTimeout(async () => {
    try {
      // Check match is still in progress
      const match = await db.match.findUnique({ where: { id: matchId }, select: { status: true } });
      if (!match || match.status !== 'IN_PROGRESS') return;

      // Create correct submission
      const submission = await db.submission.create({
        data: {
          matchId,
          userId: botUserId,
          problemId,
          language: 'cpp',
          code: '// AI solution',
          mode: 'SUBMIT',
          verdict: 'AC',
          passed: 1,
          total: 1,
        },
      });

      // Update progress to SOLVED
      const progress = await db.matchProgress.findFirst({
        where: { matchId, userId: botUserId, problemId },
      });
      if (progress) {
        const problem = await db.problem.findUnique({ where: { id: problemId }, select: { points: true } });
        const scoreEarned = (problem?.points ?? 100) - progress.wrongSubmissions * 10;

        await db.matchProgress.update({
          where: { id: progress.id },
          data: {
            status: 'SOLVED',
            solvedAt: new Date(),
            scoreEarned: Math.max(0, scoreEarned),
          },
        });

        // Unlock next problem
        const nextOrder = problemOrder + 1;
        const nextProgress = await db.matchProgress.findFirst({
          where: { matchId, userId: botUserId, problemOrder: nextOrder },
        });
        if (nextProgress) {
          await db.matchProgress.update({
            where: { id: nextProgress.id },
            data: { status: 'UNLOCKED', unlockedAt: new Date() },
          });
        }
      }

      // Emit verdict
      const verdictPayload: SubmissionVerdictPayload = {
        matchId,
        submissionId: submission.id,
        userId: botUserId,
        problemId,
        problemOrder,
        verdict: 'AC',
        passed: 1,
        total: 1,
        timeMs: null,
        memoryKb: null,
      };
      await emitToMatch(matchId, 'submission:verdict', verdictPayload);

      // Emit opponent progress
      const botSnapshot = await buildSnapshot(matchId, botUserId, matchTotalProblems);
      const humanSnapshot = await buildSnapshot(matchId, humanUserId, matchTotalProblems);
      await emitToMatch(matchId, 'opponent:progress', botSnapshot);
      await emitToMatch(matchId, 'opponent:progress', humanSnapshot);

      // Notify human player of bot's solve (triggers the "opponent solved" sound)
      await emitToUser(humanUserId, 'opponent:solved', { problemOrder });

      console.log(`[bot] Solved ${matchId} problem ${problemOrder} (${difficulty})`);

      // Check if bot has solved all problems → early finish
      const allProgress = await db.matchProgress.findMany({
        where: { matchId, userId: botUserId },
      });
      const allDone = allProgress.every((p) => p.status === 'SOLVED');

      if (allDone) {
        console.log(`[bot] All problems solved for ${matchId}, finalizing...`);
        const finalResult = await finalizeMatch({ matchId, reason: 'early_finish' });

        // Emit match:end
        const matchData = await db.match.findUnique({ where: { id: matchId } });
        if (matchData) {
          const endPayload: MatchEndPayload = {
            matchId,
            status: 'COMPLETED',
            winnerId: matchData.winnerId,
            scoreA: matchData.scoreA,
            scoreB: matchData.scoreB,
            eloDeltaA: matchData.eloDeltaA,
            eloDeltaB: matchData.eloDeltaB,
            reason: 'early_finish',
          };
          await emitToMatch(matchId, 'match:end', endPayload);
        }

        // Clean up timers
        const timers = scheduledTimers.get(matchId);
        if (timers) {
          timers.forEach(clearTimeout);
          scheduledTimers.delete(matchId);
        }

        // Clean up processedSubmissions entries for this match
        for (const key of processedSubmissions) {
          if (key.startsWith(`${matchId}:`)) {
            processedSubmissions.delete(key);
          }
        }
      }
    } catch (err) {
      console.error(`[bot] Error in correct submission:`, err);
    }
  }, hasWrong ? wrongDelay + solveDelay : solveDelay);
  timers.push(correctTimer);

  scheduledTimers.set(matchId, [...(scheduledTimers.get(matchId) ?? []), ...timers]);
}

/**
 * Process a single practice match — schedule bot submissions for unlocked problems.
 */
async function processBot(match: any, botUserId: string) {
  const { id: matchId, practiceDifficulty, totalProblems } = match;
  const difficulty = practiceDifficulty ?? 'MEDIUM';

  // Find the human player (playerA)
  const humanUserId = match.playerAId;

  // Find the bot's current unlocked problem
  const botProgress = match.progress
    .filter((p: any) => p.userId === botUserId)
    .sort((a: any, b: any) => a.problemOrder - b.problemOrder);

  const unlockedProblem = botProgress.find((p: any) => p.status === 'UNLOCKED');
  if (!unlockedProblem) return; // Bot is either done or all locked (shouldn't happen)

  // Check if we already have a submission scheduled for this problem
  const key = `${matchId}:${unlockedProblem.problemOrder}`;
  if (processedSubmissions.has(key)) return;

  // Get the problem's actual difficulty
  const problem = await db.problem.findUnique({
    where: { id: unlockedProblem.problemId },
    select: { difficulty: true },
  });

  console.log(`[bot] Processing ${matchId} — problem ${unlockedProblem.problemOrder} (${problem?.difficulty ?? 'EASY'})`);

  await scheduleBotSubmission(
    matchId,
    botUserId,
    humanUserId,
    unlockedProblem.problemId,
    unlockedProblem.problemOrder,
    problem?.difficulty ?? 'EASY',
    totalProblems,
    difficulty,
  );
}

async function poll() {
  try {
    // Find bot user
    const bot = await db.user.findUnique({ where: { email: BOT_EMAIL }, select: { id: true } });
    if (!bot) return;

    // Find practice matches where bot is playerB and match is in progress
    const matches = await db.match.findMany({
      where: {
        isPractice: true,
        status: 'IN_PROGRESS',
        playerBId: bot.id,
      },
      include: {
        progress: true,
      },
    });

    for (const match of matches) {
      await processBot(match, bot.id);
    }
  } catch (err) {
    console.error('[bot] Poll error:', err);
  }
}

// Recursive setTimeout — prevents overlapping polls
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let shuttingDown = false;

function scheduleNextPoll() {
  if (shuttingDown) return;
  pollTimer = setTimeout(async () => {
    await poll();
    scheduleNextPoll();
  }, POLL_INTERVAL_MS);
}

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`[bot] Received ${signal}, shutting down...`);
  shuttingDown = true;
  if (pollTimer) clearTimeout(pollTimer);
  // Clear all scheduled timers
  for (const timers of scheduledTimers.values()) {
    timers.forEach(clearTimeout);
  }
  scheduledTimers.clear();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => console.error('[bot] Unhandled rejection:', err));
process.on('uncaughtException', (err) => console.error('[bot] Uncaught exception:', err));

console.log('[bot] Starting bot worker...');
scheduleNextPoll();
