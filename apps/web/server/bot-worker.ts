/**
 * Bot worker — processes AI practice matches.
 *
 * Polls for practice matches where the bot is playerB and schedules
 * simulated submissions based on difficulty profiles.
 *
 * Bot behavior:
 * - Takes ~5-6 min per problem (realistic for 20-min duels)
 * - Multiple wrong submissions possible (EASY: 2, MEDIUM: 3, HARD: 1)
 * - Occasionally "gets stuck" (extra delay before solving)
 * - Timing jitter makes behavior unpredictable
 * - Cleans up memory on match completion/timeout
 *
 * Runs as a separate process: pnpm dev:bot
 */

import { db } from '@zapdos/db';
import { finalizeMatch } from '@zapdos/match';
import {
  BOT_EMAIL,
  BOT_PROFILES,
  getSolveDelay,
  applyJitter,
  randInt,
  type BotProfile,
} from '../lib/bot-config';
import { emitSocketEvent } from '../lib/socket';
import { matchRoom } from '@zapdos/realtime';
import type { SubmissionVerdictPayload, OpponentSnapshot, MatchEndPayload } from '@zapdos/realtime';

const POLL_INTERVAL_MS = 2000;
const CLEANUP_INTERVAL_MS = 60_000; // Clean up stale entries every 60s

/** Track which problems we've already scheduled to avoid duplicate submissions. */
const processedSubmissions = new Set<string>(); // `${matchId}:${problemOrder}`

/** Track scheduled timers so we can clean up on match end. */
const scheduledTimers = new Map<string, NodeJS.Timeout[]>(); // matchId -> timers

let lastCleanupTime = Date.now();

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
 * Create a wrong submission record and emit events.
 */
async function createWrongSubmission(
  matchId: string,
  botUserId: string,
  humanUserId: string,
  problemId: string,
  problemOrder: number,
  matchTotalProblems: number,
) {
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
}

/**
 * Create a correct submission record and emit events.
 * Returns true if bot solved all problems (early finish).
 */
async function createCorrectSubmission(
  matchId: string,
  botUserId: string,
  humanUserId: string,
  problemId: string,
  problemOrder: number,
  matchTotalProblems: number,
): Promise<boolean> {
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

  // Notify human player of bot's solve
  await emitToUser(humanUserId, 'opponent:solved', { problemOrder });

  console.log(`[bot] Solved ${matchId} problem ${problemOrder}`);

  // Check if bot has solved all problems → early finish
  const allProgress = await db.matchProgress.findMany({
    where: { matchId, userId: botUserId },
  });
  const allDone = allProgress.every((p) => p.status === 'SOLVED');

  if (allDone) {
    console.log(`[bot] All problems solved for ${matchId}, finalizing...`);
    await finalizeMatch({ matchId, reason: 'early_finish' });

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

    // Clean up timers for this match
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

    return true;
  }

  return false;
}

/**
 * Schedule bot submissions for a problem.
 * Handles multiple wrong submissions, stuck behavior, and timing jitter.
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

  // Determine number of wrong submissions (0 to maxWrongSubmissions)
  const numWrong = Math.random() < profile.wrongChance
    ? randInt(1, profile.maxWrongSubmissions)
    : 0;

  // Check if bot "gets stuck" (adds extra delay)
  const isStuck = Math.random() < profile.stuckChance;
  const stuckDelay = isStuck ? applyJitter(randInt(profile.stuckDelay[0], profile.stuckDelay[1]), profile.timingJitter) : 0;

  // Base solve delay with jitter
  const solveDelay = getSolveDelay(profile, problemDifficulty);

  const timers: NodeJS.Timeout[] = [];
  let totalWrongDelay = 0;

  // Schedule wrong submissions
  for (let i = 0; i < numWrong; i++) {
    const wrongDelay = applyJitter(randInt(profile.wrongDelay[0], profile.wrongDelay[1]), profile.timingJitter);
    totalWrongDelay += wrongDelay;

    const timer = setTimeout(async () => {
      try {
        // Check match is still in progress
        const match = await db.match.findUnique({ where: { id: matchId }, select: { status: true } });
        if (!match || match.status !== 'IN_PROGRESS') return;

        await createWrongSubmission(
          matchId, botUserId, humanUserId, problemId, problemOrder, matchTotalProblems,
        );
      } catch (err) {
        console.error(`[bot] Error in wrong submission:`, err);
      }
    }, totalWrongDelay);
    timers.push(timer);
  }

  // Schedule correct submission (after all wrong delays + stuck delay + solve delay)
  const totalDelay = totalWrongDelay + stuckDelay + solveDelay;

  const correctTimer = setTimeout(async () => {
    try {
      // Check match is still in progress
      const match = await db.match.findUnique({ where: { id: matchId }, select: { status: true } });
      if (!match || match.status !== 'IN_PROGRESS') return;

      await createCorrectSubmission(
        matchId, botUserId, humanUserId, problemId, problemOrder, matchTotalProblems,
      );
    } catch (err) {
      console.error(`[bot] Error in correct submission:`, err);
    }
  }, totalDelay);
  timers.push(correctTimer);

  scheduledTimers.set(matchId, [...(scheduledTimers.get(matchId) ?? []), ...timers]);
}

/**
 * Process a single practice match — schedule bot submissions for unlocked problems.
 */
async function processBot(match: {
  id: string;
  playerAId: string;
  practiceDifficulty: string | null;
  totalProblems: number;
  progress: Array<{
    userId: string;
    problemId: string;
    problemOrder: number;
    status: string;
  }>;
}, botUserId: string) {
  const { id: matchId, practiceDifficulty, totalProblems, playerAId } = match;
  const difficulty = practiceDifficulty ?? 'MEDIUM';

  // Find the bot's current unlocked problem
  const botProgress = match.progress
    .filter((p) => p.userId === botUserId)
    .sort((a, b) => a.problemOrder - b.problemOrder);

  const unlockedProblem = botProgress.find((p) => p.status === 'UNLOCKED');
  if (!unlockedProblem) return; // Bot is either done or all locked

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
    playerAId,
    unlockedProblem.problemId,
    unlockedProblem.problemOrder,
    problem?.difficulty ?? 'EASY',
    totalProblems,
    difficulty,
  );
}

/**
 * Clean up stale entries from processedSubmissions.
 * Runs periodically to prevent memory leaks from completed/timed-out matches.
 */
async function cleanupStaleEntries() {
  try {
    // Find all active practice matches
    const activeMatches = await db.match.findMany({
      where: { status: 'IN_PROGRESS', isPractice: true },
      select: { id: true },
    });
    const activeMatchIds = new Set(activeMatches.map((m) => m.id));

    // Remove entries for matches that are no longer active
    let cleaned = 0;
    for (const key of processedSubmissions) {
      const matchId = key.split(':')[0];
      if (matchId && !activeMatchIds.has(matchId)) {
        processedSubmissions.delete(key);
        cleaned++;
      }
    }

    // Also clean up timers for inactive matches
    for (const [matchId, timers] of scheduledTimers) {
      if (!activeMatchIds.has(matchId)) {
        timers.forEach(clearTimeout);
        scheduledTimers.delete(matchId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[bot] Cleaned up ${cleaned} stale entries`);
    }
  } catch (err) {
    console.error('[bot] Cleanup error:', err);
  }
}

async function poll() {
  try {
    // Periodic cleanup of stale entries
    if (Date.now() - lastCleanupTime > CLEANUP_INTERVAL_MS) {
      await cleanupStaleEntries();
      lastCleanupTime = Date.now();
    }

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
