'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { io, Socket } from 'socket.io-client';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import type { MatchEndPayload, SubmissionVerdictPayload, OpponentSnapshot } from '@cp-battle/realtime';
import RaceTrack from '@/components/RaceTrack';
import { ConfettiCanvas } from '@/components/Confetti';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { resumeAudio, playJudged, playVictory, playDefeat, playProblemSolved, playOpponentSolved } from '@/lib/sounds';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface Problem {
  id: string;
  slug: string;
  title: string;
  descriptionMd: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  points: number;
  starterCode: Record<string, string>;
  problemOrder: number;
  progress: {
    status: string;
    wrongSubmissions: number;
    scoreEarned: number;
  };
}

type LanguageId = 'cpp' | 'python' | 'java';

const LANG_LABELS: Record<LanguageId, string> = {
  cpp: 'C++',
  python: 'Python',
  java: 'Java',
};

interface VerdictResult {
  verdict: string;
  passed: number;
  total: number;
  error?: string;
  timeMs?: number;
  memoryKb?: number;
}

export default function BattlePage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const matchId = params.matchId as string;

  const [problems, setProblems] = useState<Problem[]>([]);
  const [activeProblem, setActiveProblem] = useState(0);
  const [language, setLanguage] = useState<LanguageId>('cpp');
  const [code, setCode] = useState('');
  const [verdict, setVerdict] = useState<VerdictResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);
  const [matchEnd, setMatchEnd] = useState<MatchEndPayload | null>(null);
  const [opponentName, setOpponentName] = useState('Opponent');
  const [scores, setScores] = useState({ player: 0, opponent: 0 });
  const [raceProgress, setRaceProgress] = useState({ player: 0, opponent: 0 });
  const [solvedCount, setSolvedCount] = useState({ player: 0, opponent: 0 });
  const [totalProblems, setTotalProblems] = useState(3);
  const [outputTab, setOutputTab] = useState<'result' | 'description'>('result');
  const [matchMode, setMatchMode] = useState('SPRINT');
  const [eloDelta, setEloDelta] = useState(0);
  const [eloAnimating, setEloAnimating] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const activeProblemRef = useRef(activeProblem);
  activeProblemRef.current = activeProblem;
  const problemsRef = useRef(problems);
  problemsRef.current = problems;
  const myUserId = (session?.user as any)?.id;

  // Load match problems via REST (initial load only)
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/signin?callbackUrl=/battle/' + matchId);
      return;
    }
    if (authStatus !== 'authenticated') return;

    fetch(`/api/match/${matchId}/problems`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => {
        setProblems(data.problems);
        setMatchMode(data.mode || 'SPRINT');
        setTotalProblems(data.totalProblems || 3);
        const first = data.problems.find((p: Problem) => p.progress.status === 'UNLOCKED');
        if (first) {
          setActiveProblem(data.problems.indexOf(first));
          setCode(first.starterCode[language] || '');
        }
      })
      .catch(() => router.push('/play'));
  }, [matchId, authStatus, router]);

  // Load opponent data (initial fetch only — updates come via socket)
  useEffect(() => {
    fetch(`/api/match/${matchId}/opponent`)
      .then((r) => r.json())
      .then((data) => {
        setScores(data.scores || { player: 0, opponent: 0 });
        setRaceProgress(data.raceProgress || { player: 0, opponent: 0 });
        setSolvedCount(data.solvedCount || { player: 0, opponent: 0 });
        setTotalProblems(data.totalProblems || 3);
        if (data.opponent?.username) setOpponentName(data.opponent.username);
      })
      .catch(() => {});
  }, [matchId]);

  // Socket.IO connection — the single source of truth for real-time events
  useEffect(() => {
    if (authStatus !== 'authenticated' || !session?.user) return;

    const socket = io(
      typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.hostname}:3002`
        : 'http://localhost:3002',
      { transports: ['websocket', 'polling'] },
    );

    socket.on('connect', () => {
      socket.emit('match:join', matchId, () => {});
    });

    // Match start — opponent data delivered here
    socket.on('match:start' as any, (payload: any) => {
      if (payload.opponent) {
        setOpponentName(payload.opponent.username);
      }
      if (payload.endsAt) {
        const endsAt = new Date(payload.endsAt).getTime();
        startTimer(endsAt);
      }
    });

    // Submission verdict — YOUR submission result
    socket.on('submission:verdict' as any, (payload: SubmissionVerdictPayload) => {
      if (payload.problemId === problemsRef.current[activeProblemRef.current]?.id) {
        setVerdict({
          verdict: payload.verdict,
          passed: payload.passed,
          total: payload.total,
          error: payload.error,
          timeMs: payload.timeMs ?? undefined,
          memoryKb: payload.memoryKb ?? undefined,
        });
        playJudged(payload.verdict);
      }
    });

    // Opponent progress — the "pressure" feed
    socket.on('opponent:progress' as any, (payload: OpponentSnapshot) => {
      // Only update if this is the OPPONENT's data
      if (payload.userId !== myUserId) {
        setRaceProgress((prev) => ({ ...prev, opponent: payload.raceProgress }));
        setSolvedCount((prev) => ({ ...prev, opponent: payload.solvedCount }));
        setScores((prev) => ({ ...prev, opponent: payload.score }));
        playOpponentSolved();
      } else {
        // Our own data updated
        setRaceProgress((prev) => ({ ...prev, player: payload.raceProgress }));
        setSolvedCount((prev) => ({ ...prev, player: payload.solvedCount }));
        setScores((prev) => ({ ...prev, player: payload.score }));
      }
    });

    // Problem unlocked for us
    socket.on('problem:unlocked' as any, (payload: { problemOrder: number }) => {
      playProblemSolved();
      // Reload problems to get updated progress
      fetch(`/api/match/${matchId}/problems`)
        .then((r) => r.json())
        .then((data) => {
          setProblems(data.problems);
          // Auto-advance to the unlocked problem
          const unlocked = data.problems.find((p: Problem) => p.progress.status === 'UNLOCKED');
          if (unlocked) {
            setActiveProblem(data.problems.indexOf(unlocked));
            setCode(unlocked.starterCode[language] || '');
            setVerdict(null);
          }
        });
    });

    // Timer sync
    socket.on('timer:sync' as any, (payload: { endsAt: string; remainingMs: number }) => {
      setRemainingMs(payload.remainingMs);
    });

    // Match end
    socket.on('match:end' as any, (payload: MatchEndPayload) => {
      setMatchEnd(payload);
      const isWinner = payload.winnerId === myUserId;
      const isDraw = !payload.winnerId;
      if (isWinner) {
        setShowConfetti(true);
        playVictory();
      } else if (!isDraw) {
        playDefeat();
      }
      // Animate ELO delta
      const isPlayerA = payload.scoreA >= payload.scoreB;
      const myDelta = isPlayerA ? payload.eloDeltaA : payload.eloDeltaB;
      setEloDelta(myDelta);
      setEloAnimating(true);
    });

    socketRef.current = socket;

    return () => {
      socket.emit('match:leave', matchId);
      socket.disconnect();
    };
  }, [matchId, authStatus, session, myUserId, language]);

  // Timer management
  const startTimer = useCallback((endsAtMs: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const update = () => {
      const remaining = Math.max(0, endsAtMs - Date.now());
      setRemainingMs(remaining);
      if (remaining <= 0 && timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
    update();
    timerRef.current = setInterval(update, 1000);
  }, []);

  // Also start timer from REST on mount (fallback if socket hasn't connected yet)
  useEffect(() => {
    if (matchEnd) return;
    fetch('/api/match/status')
      .then((r) => r.json())
      .then((data) => {
        if (data.match?.endsAt) {
          startTimer(new Date(data.match.endsAt).getTime());
        }
      });
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [matchEnd, startTimer]);

  // Also poll for match completion as a safety net (catches forfeit from opponent)
  useEffect(() => {
    if (matchEnd) return;
    const check = () => {
      fetch(`/api/match/${matchId}/result`)
        .then((r) => r.json())
        .then((d) => {
          if (d.match?.status === 'COMPLETED') {
            setMatchEnd({
              matchId, status: 'COMPLETED', winnerId: d.match.winnerId,
              scoreA: d.match.scoreA, scoreB: d.match.scoreB,
              eloDeltaA: d.match.eloDeltaA, eloDeltaB: d.match.eloDeltaB,
              reason: d.match.endReason || 'unknown',
            });
          }
        })
        .catch(() => {});
    };
    const pollRef = setInterval(check, 5000);
    return () => clearInterval(pollRef);
  }, [matchId, matchEnd]);

  const switchLanguage = useCallback((lang: LanguageId) => {
    setLanguage(lang);
    const current = problems[activeProblem];
    if (current) setCode(current.starterCode[lang] || '');
  }, [problems, activeProblem]);

  const switchProblem = useCallback((idx: number) => {
    const p = problems[idx];
    if (!p || p.progress.status === 'LOCKED') return;
    setActiveProblem(idx);
    setCode(p.starterCode[language] || '');
    setVerdict(null);
  }, [problems, language]);

  const handleSubmit = useCallback(async (mode: 'RUN' | 'SUBMIT') => {
    const current = problems[activeProblem];
    if (!current) return;
    setSubmitting(true);
    setVerdict(null);
    resumeAudio();

    try {
      const res = await fetch(`/api/match/${matchId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId: current.id, language, code, mode }),
      });
      const data = await res.json();
      if (res.ok) {
        setVerdict({
          verdict: data.verdict, passed: data.passed, total: data.total,
          error: data.error, timeMs: data.timeMs, memoryKb: data.memoryKb,
        });
        playJudged(data.verdict);

        if (mode === 'SUBMIT' && data.verdict === 'AC') {
          playProblemSolved();
          // Reload problems (socket will also send problem:unlocked, but this is immediate)
          const probRes = await fetch(`/api/match/${matchId}/problems`);
          const probData = await probRes.json();
          setProblems(probData.problems);
          const solvedNow = probData.problems.filter((p: Problem) => p.progress.status === 'SOLVED').length;
          setSolvedCount((prev) => ({ ...prev, player: solvedNow }));
          setRaceProgress((prev) => ({ ...prev, player: solvedNow / probData.totalProblems }));

          if (solvedNow >= probData.totalProblems) {
            // Match will end — wait for socket event
            return;
          }

          const nextIdx = probData.problems.findIndex((p: Problem) => p.progress.status === 'UNLOCKED');
          if (nextIdx !== -1) {
            setActiveProblem(nextIdx);
            setCode(probData.problems[nextIdx].starterCode[language] || '');
            setVerdict(null);
          }
        }
      } else {
        setVerdict({ verdict: 'CE', passed: 0, total: 0, error: data.error || 'Submission failed' });
      }
    } catch {
      setVerdict({ verdict: 'CE', passed: 0, total: 0, error: 'Network error' });
    } finally {
      setSubmitting(false);
    }
  }, [matchId, problems, activeProblem, language, code]);

  const handleForfeit = useCallback(async () => {
    if (!confirm('Are you sure you want to forfeit?')) return;
    await fetch(`/api/match/${matchId}/forfeit`, { method: 'POST' });
    router.push('/dashboard');
  }, [matchId, router]);

  // Animated ELO counter
  const [displayElo, setDisplayElo] = useState(0);
  useEffect(() => {
    if (!eloAnimating) return;
    const target = eloDelta;
    const duration = 1500;
    const start = Date.now();
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayElo(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    animate();
  }, [eloAnimating, eloDelta]);

  // Match end screen
  if (matchEnd) {
    const isWinner = matchEnd.winnerId === myUserId;
    const isDraw = !matchEnd.winnerId;

    return (
      <>
        <ConfettiCanvas active={showConfetti} duration={4000} />
        <main className="flex min-h-[calc(100vh-3rem)] items-center justify-center px-4">
          <div className="card w-full max-w-sm p-8 text-center animate-fade-in">
            <h1
              className={`text-4xl font-semibold tracking-tight ${
                isDraw ? 'text-text-secondary' : isWinner ? 'text-success' : 'text-error'
              }`}
              style={{ letterSpacing: '-0.04em' }}
            >
              {isDraw ? 'Draw' : isWinner ? 'Victory' : 'Defeat'}
            </h1>

            <div className="mt-4 space-y-1">
              <div className="text-sm text-text-secondary font-mono tabular-nums">
                {matchEnd.scoreA} — {matchEnd.scoreB}
              </div>
              <div className="text-xs text-text-muted">
                {solvedCount.player}/{totalProblems} solved vs {solvedCount.opponent}/{totalProblems}
              </div>
            </div>

            {/* Animated ELO delta */}
            <div className="mt-6">
              <div className="text-xs text-text-muted mb-1">ELO Change</div>
              <div className={`text-4xl font-semibold tabular-nums ${
                eloDelta > 0 ? 'text-success' : eloDelta < 0 ? 'text-error' : 'text-text-muted'
              }`} style={{ letterSpacing: '-0.03em' }}>
                {eloDelta > 0 ? '+' : ''}{displayElo}
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button onClick={() => router.push('/play')} className="btn-primary flex-1 h-9 text-sm">
                Play again
              </button>
              <button onClick={() => router.push('/dashboard')} className="btn-ghost flex-1 h-9 text-sm">
                Dashboard
              </button>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (problems.length === 0) {
    return <LoadingSpinner label="Loading battle..." />;
  }

  const currentProblem = problems[activeProblem] ?? problems[0];
  if (!currentProblem) {
    return <LoadingSpinner label="Loading problems..." />;
  }

  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  const timeWarning = remainingMs < 300000;

  return (
    <main className="flex h-[calc(100vh-3rem)] flex-col">
      {/* Race track */}
      <div className="border-b border-border-subtle bg-bg-panel">
        <RaceTrack
          playerProgress={raceProgress.player}
          opponentProgress={raceProgress.opponent}
          playerName={(session?.user as any)?.username ?? 'You'}
          opponentName={opponentName}
          playerSolved={solvedCount.player}
          opponentSolved={solvedCount.opponent}
          totalProblems={totalProblems}
        />
      </div>

      {/* Top bar */}
      <div className="flex h-10 items-center justify-between border-b border-border-subtle bg-bg-panel px-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-brand tracking-tight uppercase">Battle</span>
          <div className="flex gap-0.5">
            {problems.map((p, i) => {
              const isSolved = p.progress.status === 'SOLVED';
              const isCurrent = i === activeProblem;
              const isLocked = p.progress.status === 'LOCKED';
              return (
                <button
                  key={p.id}
                  onClick={() => switchProblem(i)}
                  disabled={isLocked}
                  className={`h-6 rounded px-1.5 text-xs font-medium transition-colors ${
                    isCurrent
                      ? 'bg-brand/15 text-brand'
                      : isSolved
                      ? 'bg-success/10 text-success'
                      : isLocked
                      ? 'cursor-not-allowed text-text-muted/50'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {isSolved ? '\u2713' : i + 1}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-xs text-text-muted">
            <span className="text-text-primary font-medium">{scores.player}</span>
            <span className="mx-0.5">–</span>
            <span className="text-text-secondary">{scores.opponent}</span>
          </div>
          <div className={`font-mono text-xs tabular-nums ${timeWarning ? 'text-error' : 'text-text-secondary'}`}>
            {timeStr}
          </div>
          <button onClick={handleForfeit} className="text-xs text-text-muted hover:text-error transition-colors">
            Forfeit
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: problem description */}
        <div className="flex w-1/2 flex-col border-r border-border-subtle">
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
            <span className="text-sm font-medium text-text-primary">{currentProblem.title}</span>
            <span className="text-xs text-text-muted">
              {currentProblem.points} pts · {currentProblem.timeLimitMs}ms · {currentProblem.memoryLimitMb}MB
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 text-sm leading-relaxed text-text-secondary">
            <ReactMarkdown
              components={{
                h2: ({ children }) => <h2 className="text-lg font-semibold text-text-primary mt-6 mb-3 tracking-tight">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-medium text-text-primary mt-4 mb-2">{children}</h3>,
                code: ({ children }) => <code className="rounded bg-bg-elevated px-1.5 py-0.5 text-xs text-brand">{children}</code>,
                li: ({ children }) => <li className="ml-4">{children}</li>,
              }}
            >
              {currentProblem.descriptionMd}
            </ReactMarkdown>
          </div>
        </div>

        {/* Right: editor + output */}
        <div className="flex flex-1 flex-col">
          {/* Editor toolbar */}
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
            <div className="flex items-center gap-0.5">
              {(Object.keys(LANG_LABELS) as LanguageId[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => switchLanguage(lang)}
                  className={`h-6 rounded px-2 text-xs font-medium transition-colors ${
                    language === lang
                      ? 'bg-brand/15 text-brand'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {LANG_LABELS[lang]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleSubmit('RUN')}
                disabled={submitting || currentProblem.progress.status === 'LOCKED' || currentProblem.progress.status === 'SOLVED'}
                className="btn-ghost h-7 text-xs"
              >
                {submitting ? 'Running...' : 'Run'}
              </button>
              <button
                onClick={() => handleSubmit('SUBMIT')}
                disabled={submitting || currentProblem.progress.status === 'LOCKED' || currentProblem.progress.status === 'SOLVED'}
                className="btn-primary h-7 text-xs"
              >
                {submitting ? 'Judging...' : 'Submit'}
              </button>
            </div>
          </div>

          {/* Monaco */}
          <div className="flex-1">
            <MonacoEditor
              height="100%"
              language={language === 'cpp' ? 'cpp' : language}
              theme="vs-dark"
              value={code}
              onChange={(v) => setCode(v ?? '')}
              options={{
                fontSize: 13,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                minimap: { enabled: false },
                padding: { top: 12 },
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </div>

          {/* Output panel */}
          <div className="h-48 border-t border-border-subtle">
            <div className="flex border-b border-border-subtle">
              <button
                onClick={() => setOutputTab('result')}
                className={`px-4 py-1.5 text-xs font-medium transition-colors ${
                  outputTab === 'result' ? 'text-brand' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                Output {verdict && `(${verdict.verdict})`}
              </button>
              <button
                onClick={() => setOutputTab('description')}
                className={`px-4 py-1.5 text-xs font-medium transition-colors ${
                  outputTab === 'description' ? 'text-brand' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                Info
              </button>
            </div>
            <div className="h-[calc(100%-2rem)] overflow-y-auto p-3 font-mono text-xs">
              {outputTab === 'description' ? (
                <div className="space-y-1 text-text-muted">
                  <div>Language: {LANG_LABELS[language]}</div>
                  <div>Time limit: {currentProblem.timeLimitMs}ms</div>
                  <div>Memory limit: {currentProblem.memoryLimitMb}MB</div>
                  <div>Wrong submissions: {currentProblem.progress.wrongSubmissions}</div>
                  {currentProblem.progress.status === 'SOLVED' && (
                    <div className="text-success">Solved — {currentProblem.progress.scoreEarned} pts</div>
                  )}
                  {currentProblem.progress.status === 'LOCKED' && (
                    <div className="text-error">Locked — solve the previous problem first</div>
                  )}
                </div>
              ) : verdict ? (
                <div className="space-y-1">
                  <div className={`font-medium ${verdict.verdict === 'AC' ? 'text-success' : 'text-error'}`}>
                    {verdict.verdict} — {verdict.passed}/{verdict.total}
                  </div>
                  {verdict.timeMs != null && <div className="text-text-muted">Time: {verdict.timeMs}ms</div>}
                  {verdict.memoryKb != null && <div className="text-text-muted">Memory: {verdict.memoryKb}KB</div>}
                  {verdict.error && (
                    <pre className="mt-2 whitespace-pre-wrap text-error/80">{verdict.error}</pre>
                  )}
                </div>
              ) : (
                <div className="text-text-muted">Run or submit to see output</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
