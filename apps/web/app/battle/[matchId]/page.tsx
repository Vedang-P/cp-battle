'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { io, type Socket } from 'socket.io-client';
import type {
  MatchEndPayload,
  SubmissionVerdictPayload,
  OpponentSnapshot,
} from '@zapdos/realtime';
import { useCountdown } from '@/lib/useCountdown';
import { BattleHUD } from '@/components/battle/BattleHUD';
import { ProblemPanel } from '@/components/battle/ProblemPanel';
import { EditorPanel } from '@/components/battle/EditorPanel';
import { OutputPanel } from '@/components/battle/OutputPanel';
import { MatchEndScreen } from '@/components/battle/MatchEndScreen';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ConfirmModal } from '@/components/battle/ConfirmModal';
import {
  resumeAudio,
  playJudged,
  playVictory,
  playDefeat,
  playProblemSolved,
  playOpponentSolved,
} from '@/lib/sounds';

type LanguageId = 'cpp' | 'python' | 'java';

interface Problem {
  id: string;
  title: string;
  descriptionMd: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  points: number;
  problemOrder: number;
  starterCode?: Record<string, string>;
  progress: { status: string; wrongSubmissions: number; scoreEarned: number };
}

const DEFAULT_CODE: Record<LanguageId, string> = {
  cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // read input and solve\n    return 0;\n}\n`,
  python: `import sys\ninput = sys.stdin.readline\n\n# read input and solve\n`,
  java: `import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws IOException {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        // read input and solve\n    }\n}\n`,
};

interface VerdictResult {
  verdict: string;
  passed: number;
  total: number;
  error?: string;
  timeMs?: number;
  memoryKb?: number;
}

interface MatchMeta {
  isPractice: boolean;
  practiceDifficulty: string;
  endsAt: string | null;
  playerAId: string;
  playerBId: string;
}

// Next.js 14.2.x: params is a sync plain object in both server & client components.
// (The Promise<...> typing is a Next.js 15 feature and would break here.)
interface Props {
  params: { matchId: string };
}

const REALTIME_URL =
  process.env.NEXT_PUBLIC_REALTIME_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3002');

export default function BattlePage({ params }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const matchId = params.matchId;

  const [problems, setProblems] = useState<Problem[]>([]);
  const [activeProblem, setActiveProblem] = useState(0);
  const [language, setLanguage] = useState<LanguageId>('cpp');
  const [code, setCode] = useState(DEFAULT_CODE.cpp);
  const [scores, setScores] = useState({ player: 0, opponent: 0 });
  const [verdict, setVerdict] = useState<VerdictResult | null>(null);
  const [matchEnd, setMatchEnd] = useState<MatchEndPayload | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [outputTab, setOutputTab] = useState<'result' | 'description'>('description');
  const [eloDelta, setEloDelta] = useState(0);
  const [loading, setLoading] = useState(true);
  const [matchMeta, setMatchMeta] = useState<MatchMeta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForfeitModal, setShowForfeitModal] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const userId = session?.user?.id ?? '';

  // ── Fetch opponent state ──────────────────────────────────────────────
  const fetchOpponent = useCallback(async () => {
    try {
      const res = await fetch(`/api/match/${matchId}/opponent`);
      if (!res.ok) return;
      const data = await res.json();
      // opponent route returns { scores: { player, opponent }, ... }
      setScores({
        player: data.scores?.player ?? 0,
        opponent: data.scores?.opponent ?? 0,
      });
    } catch {
      /* ignore */
    }
  }, [matchId]);

  // ── Fetch match problems + meta on mount ──────────────────────────────
  const fetchMatchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/match/${matchId}/problems`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLoadError(data.error ?? `Failed to load match (${res.status})`);
        return;
      }
      const data = await res.json();
      setProblems(data.problems);
      setMatchMeta({
        isPractice: !!data.isPractice,
        practiceDifficulty: data.practiceDifficulty ?? '',
        endsAt: data.endsAt,
        playerAId: data.playerAId,
        playerBId: data.playerBId,
      });

      // Restore saved code for the first unlocked problem
      const firstUnlocked = (data.problems as Problem[]).find(
        (p) => p.progress.status === 'UNLOCKED',
      );
      if (firstUnlocked) {
        setActiveProblem(firstUnlocked.problemOrder ?? 0);
        const savedLang = restoreCode(matchId, firstUnlocked.id);
        if (savedLang) {
          setLanguage(savedLang.language);
          setCode(savedLang.code);
        } else if (firstUnlocked.starterCode) {
          const starter = firstUnlocked.starterCode;
          const lang = (starter.cpp ? 'cpp' : starter.python ? 'python' : 'java') as LanguageId;
          setLanguage(lang);
          setCode(starter[lang] ?? DEFAULT_CODE[lang]);
        }
      }

      // Fetch opponent initial state so scores are correct
      fetchOpponent();
    } catch {
      setLoadError('Failed to load match');
    } finally {
      setLoading(false);
    }
  }, [matchId, fetchOpponent]);

  useEffect(() => {
    if (matchId) fetchMatchData();
  }, [matchId, fetchMatchData]);

  // ── Per-problem code persistence ──────────────────────────────────────
  useEffect(() => {
    const currentProb = problems[activeProblem];
    if (!matchId || !currentProb) return;
    const key = `zapdos-code-${matchId}-${currentProb.id}`;
    localStorage.setItem(key, JSON.stringify({ language, code }));
  }, [matchId, activeProblem, language, code, problems]);

  // ── Countdown ─────────────────────────────────────────────────────────
  const { timeStr, timeWarning, isFinished } = useCountdown({
    endsAt: matchMeta?.endsAt ?? null,
    matchId,
  });

  // ── Local match:end fallback if server never sends it ─────────────────
  useEffect(() => {
    if (isFinished && !matchEnd && matchMeta) {
      // Fetch the authoritative result
      fetch(`/api/match/${matchId}/result`)
        .then((r) => (r.ok ? r.json() : null))
        .then((resp) => {
          if (resp?.match) {
            const m = resp.match;
            const isPlayerA = matchMeta.playerAId === userId;
            setMatchEnd({
              matchId,
              status: 'COMPLETED',
              winnerId: m.winnerId ?? null,
              scoreA: m.scoreA ?? 0,
              scoreB: m.scoreB ?? 0,
              eloDeltaA: m.eloDeltaA ?? 0,
              eloDeltaB: m.eloDeltaB ?? 0,
              reason: 'time',
            });
            setEloDelta(isPlayerA ? (m.eloDeltaA ?? 0) : (m.eloDeltaB ?? 0));
          }
        })
        .catch(() => {});
    }
  }, [isFinished, matchEnd, matchId, matchMeta, userId]);

  // ── Socket.IO connection ──────────────────────────────────────────────
  useEffect(() => {
    if (!matchId || !userId || !session?.user?.username) return;

    let socket: Socket | null = null;

    (async () => {
      // Fetch a short-lived JWT for the realtime handshake
      let token: string | null = null;
      try {
        const r = await fetch('/api/auth/socket-token');
        if (r.ok) {
          const t = await r.json();
          token = t.token;
        }
      } catch {
        /* fall through; socket will fail to auth */
      }
      if (!token) return;

      socket = io(REALTIME_URL, {
        transports: ['websocket', 'polling'],
        auth: { token },
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        socket!.emit('match:join', matchId, (ok: boolean) => {
          if (!ok) console.warn('[battle] server rejected match:join');
        });
      });

      socket.on('connect_error', (err: Error) => {
        console.warn('[battle] socket connect error:', err.message);
      });

      socket.on('opponent:progress', (data: OpponentSnapshot) => {
        if (data.userId === userId) {
          setScores((prev) => ({ ...prev, player: data.score }));
        } else {
          setScores((prev) => ({ ...prev, opponent: data.score }));
        }
      });

      socket.on('submission:verdict', (data: SubmissionVerdictPayload) => {
        // Only react to OUR OWN verdicts. Opponent verdicts are filtered out
        // so they don't unlock our submit button or pollute our output panel.
        if (data.userId !== userId) {
          // Opponent got a verdict — maybe play a tension sound
          if (data.verdict === 'AC') playOpponentSolved();
          return;
        }
        setVerdict({
          verdict: data.verdict,
          passed: data.passed,
          total: data.total,
          error: data.error,
          timeMs: data.timeMs ?? undefined,
          memoryKb: data.memoryKb ?? undefined,
        });
        setIsSubmitting(false);
        setOutputTab('result');
        resumeAudio();
        playJudged(data.verdict);
        if (data.verdict === 'AC') playProblemSolved();
      });

      socket.on('match:end', (data: MatchEndPayload) => {
        if (!matchMeta) return;
        const isPlayerA = matchMeta.playerAId === userId;
        const myDelta = isPlayerA ? data.eloDeltaA : data.eloDeltaB;
        const opponentDelta = isPlayerA ? data.eloDeltaB : data.eloDeltaA;
        const myScore = isPlayerA ? data.scoreA : data.scoreB;
        const oppScore = isPlayerA ? data.scoreB : data.scoreA;
        const iWon = data.winnerId === userId;
        const isDraw = data.winnerId === null;

        setMatchEnd(data);
        setEloDelta(myDelta);
        setScores({ player: myScore, opponent: oppScore });

        resumeAudio();
        if (iWon) {
          playVictory();
        } else if (!isDraw) {
          playDefeat();
        }
        void opponentDelta; // available if needed later
      });

      socket.on('problem:unlocked', () => {
        // Re-fetch the full problem set so the newly unlocked problem appears
        fetchMatchData();
      });
    })();

    return () => {
      if (socket) {
        socket.emit('match:leave', matchId);
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, [matchId, userId, session?.user?.username, matchMeta, fetchMatchData]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const currentProblem = problems[activeProblem];

  const handleLanguageChange = useCallback((lang: LanguageId) => {
    setLanguage(lang);
    if (currentProblem?.starterCode?.[lang]) {
      setCode(currentProblem.starterCode[lang]!);
    } else {
      setCode(DEFAULT_CODE[lang]);
    }
  }, [currentProblem]);

  const handleRun = useCallback(async () => {
    if (!currentProblem || isSubmitting) return;
    setIsSubmitting(true);
    setVerdict(null);
    setOutputTab('result');
    try {
      const res = await fetch(`/api/match/${matchId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemId: currentProblem.id,
          language,
          code,
          mode: 'RUN',
        }),
      });
      const data = await res.json();
      if (data.verdict) {
        setVerdict({
          verdict: data.verdict,
          passed: data.passed ?? 0,
          total: data.total ?? 0,
          error: data.error,
          timeMs: data.timeMs ?? undefined,
          memoryKb: data.memoryKb ?? undefined,
        });
      } else if (data.error) {
        setVerdict({ verdict: 'ERROR', passed: 0, total: 0, error: data.error });
      } else {
        setVerdict({ verdict: 'ERROR', passed: 0, total: 0, error: 'Unknown error' });
      }
      setIsSubmitting(false);
    } catch {
      setVerdict({ verdict: 'ERROR', passed: 0, total: 0, error: 'Request failed. Check your connection.' });
      setIsSubmitting(false);
    }
  }, [currentProblem, isSubmitting, matchId, language, code]);

  const handleSubmit = useCallback(async () => {
    if (!currentProblem || isSubmitting) return;
    setIsSubmitting(true);
    setVerdict(null);
    setOutputTab('result');
    try {
      const res = await fetch(`/api/match/${matchId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemId: currentProblem.id,
          language,
          code,
          mode: 'SUBMIT',
        }),
      });
      const data = await res.json();
      if (data.verdict) {
        setVerdict({
          verdict: data.verdict,
          passed: data.passed ?? 0,
          total: data.total ?? 0,
          error: data.error,
          timeMs: data.timeMs ?? undefined,
          memoryKb: data.memoryKb ?? undefined,
        });
        setIsSubmitting(false);
      } else if (data.error) {
        setVerdict({ verdict: 'ERROR', passed: 0, total: 0, error: data.error });
        setIsSubmitting(false);
      } else {
        setIsSubmitting(false);
      }
    } catch {
      setVerdict({ verdict: 'ERROR', passed: 0, total: 0, error: 'Request failed. Check your connection.' });
      setIsSubmitting(false);
    }
  }, [currentProblem, isSubmitting, matchId, language, code]);

  const handleForfeit = useCallback(async () => {
    setShowForfeitModal(false);
    try {
      await fetch(`/api/match/${matchId}/forfeit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch {
      /* ignore */
    }
  }, [matchId]);

  // ── Keyboard shortcuts (Ctrl+Enter to submit; avoid Ctrl+R which is refresh) ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit]);

  // ── Warn before leaving an in-progress match ──────────────────────────
  useEffect(() => {
    if (matchEnd || matchMeta?.isPractice) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Leaving will forfeit the match.';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [matchEnd, matchMeta?.isPractice]);

  // ── Render ────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <main className="flex h-[calc(100vh-3rem)] flex-col items-center justify-center gap-4">
        <p className="font-mono text-error glow-red">{loadError}</p>
        <button onClick={() => router.push('/play')} className="btn btn-ghost">
          Back to lobby
        </button>
      </main>
    );
  }

  if (matchEnd) {
    return (
      <MatchEndScreen
        matchEnd={matchEnd}
        myUserId={userId}
        isPractice={matchMeta?.isPractice ?? false}
        practiceDifficulty={matchMeta?.practiceDifficulty ?? ''}
        eloDelta={eloDelta}
        solvedCount={{
          player: scores.player,
          opponent: scores.opponent,
        }}
        totalProblems={problems.length}
        onRematch={() => router.push('/play')}
        onDashboard={() => router.push('/dashboard')}
      />
    );
  }

  if (loading || !currentProblem) {
    return (
      <main className="flex h-[calc(100vh-3rem)] items-center justify-center">
        <LoadingSpinner label="loading match..." />
      </main>
    );
  }

  return (
    <main id="main-content" className="h-[calc(100vh-3rem)] flex flex-col">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-bg-elevated focus:text-brand">
        Skip to content
      </a>
      <BattleHUD
        problems={problems}
        activeProblem={activeProblem}
        currentProblem={currentProblem}
        language={language}
        scores={scores}
        timeStr={timeStr}
        timeWarning={timeWarning}
        isPractice={matchMeta?.isPractice ?? false}
        onSwitchProblem={setActiveProblem}
        onForfeit={() => setShowForfeitModal(true)}
      />
      <div className="flex min-h-0 flex-1 flex-row max-md:flex-col">
        <ProblemPanel problem={currentProblem} />
        <EditorPanel
          language={language}
          code={code}
          onCodeChange={setCode}
          onLanguageChange={handleLanguageChange}
          onRun={handleRun}
          onSubmit={handleSubmit}
          submitting={isSubmitting}
          isDisabled={currentProblem.progress.status === 'LOCKED'}
        />
      </div>
      <OutputPanel
        outputTab={outputTab}
        onTabChange={setOutputTab}
        verdict={verdict}
        problem={currentProblem}
        language={language}
      />
      {showForfeitModal && (
        <ConfirmModal
          title="forfeit.sh"
          message="Forfeit this match? This counts as a loss."
          confirmLabel="> confirm forfeit"
          onConfirm={handleForfeit}
          onCancel={() => setShowForfeitModal(false)}
        />
      )}
    </main>
  );
}

/** Read saved code for a (matchId, problemId) pair from localStorage. */
function restoreCode(matchId: string, problemId: string): { language: LanguageId; code: string } | null {
  try {
    const key = `zapdos-code-${matchId}-${problemId}`;
    const saved = localStorage.getItem(key);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as { language?: LanguageId; code?: string };
    if (parsed.language && parsed.code) {
      return { language: parsed.language, code: parsed.code };
    }
  } catch {
    /* ignore */
  }
  return null;
}
