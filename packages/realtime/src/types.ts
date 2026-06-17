/**
 * @cp-battle/realtime — shared Socket.IO event contracts.
 *
 * These types are imported by BOTH the realtime server (apps/web/server) and
 * the browser client, so the wire format can never drift between them.
 *
 * Naming convention:
 *   - ClientEvents: emitted by the browser, consumed by the server.
 *   - ServerEvents: emitted by the server, consumed by the browser.
 */

// ---------------------------------------------------------------------------
// Room helpers
// ---------------------------------------------------------------------------

/** Every match gets its own Socket.IO room, named `match:<id>`. */
export const matchRoom = (matchId: string): string => `match:${matchId}`;

/** A player's personal room for direct delivery (e.g. "you won"). */
export const userRoom = (userId: string): string => `user:${userId}`;

// ---------------------------------------------------------------------------
// Primitives shared across events
// ---------------------------------------------------------------------------

export type ProblemDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type SubmissionVerdict =
  | 'PENDING'
  | 'RUNNING'
  | 'AC'
  | 'WA'
  | 'TLE'
  | 'MLE'
  | 'RE'
  | 'CE';

export type MatchStatus = 'QUEUING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

/** Per-(user, problem) progress within a single match. */
export type ProblemProgressStatus = 'LOCKED' | 'UNLOCKED' | 'SOLVED';

export interface ProblemProgressPublic {
  difficulty: ProblemDifficulty;
  status: ProblemProgressStatus;
  /** Test cases passed so far on the player's latest submission, if any. */
  passed: number | null;
  /** Total test cases for this problem. */
  total: number | null;
  /** Wrong (non-AC) submissions on this problem. Drives the pressure factor. */
  wrongSubmissions: number;
}

/**
 * The sanitized view of a player's progress shown to their OPPONENT.
 * Critically: contains NO code, NO per-test input/expected, NO submission text.
 * This is the value that flows over `opponent:progress`.
 */
export interface OpponentSnapshot {
  userId: string;
  username: string;
  score: number;
  /** Per-problem progress, one entry per difficulty in the match. */
  problems: ProblemProgressPublic[];
}

// ---------------------------------------------------------------------------
// Client -> Server events
// ---------------------------------------------------------------------------

export interface ClientEvents {
  /** Join the room for a match you're a participant in. */
  'match:join': (matchId: string, ack?: (ok: boolean) => void) => void;
  /** Leave a match room (e.g. navigating away, but NOT forfeiting). */
  'match:leave': (matchId: string) => void;
  /** Voluntarily forfeit the current match. */
  'match:forfeit': (matchId: string) => void;
  /** Heartbeat so the server can detect zombies even if TCP keeps the socket. */
  'match:heartbeat': (matchId: string) => void;
}

// ---------------------------------------------------------------------------
// Server -> Client events
// ---------------------------------------------------------------------------

export interface MatchStartPayload {
  matchId: string;
  /** ISO timestamp at which the battle ends. Client renders a countdown from this. */
  endsAt: string;
  durationSeconds: number;
  opponent: {
    userId: string;
    username: string;
    elo: number;
  };
  /** The three problems, with only the easy one unlocked for both players. */
  problems: {
    easy: MatchProblemBrief;
    medium: MatchProblemBrief;
    hard: MatchProblemBrief;
  };
}

/** Problem info delivered at match start (description lives on a REST fetch). */
export interface MatchProblemBrief {
  problemId: string;
  slug: string;
  title: string;
  difficulty: ProblemDifficulty;
  /** Starter code per supported language, keyed by language id. */
  starterCode: Record<string, string>;
  timeLimitMs: number;
  memoryLimitMb: number;
}

export interface ServerEvents {
  /** Fired when both players are in the room and the clock should start. */
  'match:start': (payload: MatchStartPayload) => void;
  /** Verdict for YOUR own submission (full detail, your own code). */
  'submission:verdict': (payload: SubmissionVerdictPayload) => void;
  /** Sanitized opponent progress update — the core "pressure" feed. */
  'opponent:progress': (payload: OpponentSnapshot) => void;
  /** Fired when a new problem unlocks for you (you just solved the previous). */
  'problem:unlocked': (payload: { difficulty: ProblemDifficulty }) => void;
  /** Authoritative tick; clients resync their countdown to this. */
  'timer:sync': (payload: { endsAt: string; remainingMs: number }) => void;
  /** Match concluded with final scores and ELO deltas. */
  'match:end': (payload: MatchEndPayload) => void;
  /** Generic error channel for things like "not your match". */
  'match:error': (payload: { message: string }) => void;
}

export interface SubmissionVerdictPayload {
  matchId: string;
  submissionId: string;
  problemId: string;
  difficulty: ProblemDifficulty;
  verdict: SubmissionVerdict;
  passed: number;
  total: number;
  timeMs: number | null;
  memoryKb: number | null;
  /** Stdout/stderr/compile errors — only sent to the submitting player. */
  error?: string;
}

export interface MatchEndPayload {
  matchId: string;
  status: MatchStatus;
  winnerId: string | null; // null => draw
  scoreA: number;
  scoreB: number;
  eloDeltaA: number;
  eloDeltaB: number;
  /** Why the match ended. */
  reason: 'time' | 'both_solved' | 'forfeit' | 'disconnect' | 'cancelled';
}
