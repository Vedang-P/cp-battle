'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { io, Socket } from 'socket.io-client';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import type { MatchEndPayload, SubmissionVerdictPayload, OpponentSnapshot } from '@cp-battle/realtime';
import RaceTrack from '@/components/RaceTrack';

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
  const [opponentProgress, setOpponentProgress] = useState<any[]>([]);
  const [scores, setScores] = useState({ player: 0, opponent: 0 });
  const [raceProgress, setRaceProgress] = useState({ player: 0, opponent: 0 });
  const [solvedCount, setSolvedCount] = useState({ player: 0, opponent: 0 });
  const [totalProblems, setTotalProblems] = useState(3);
  const [outputTab, setOutputTab] = useState<'result' | 'description'>('description');
  const [socketConnected, setSocketConnected] = useState(false);
  const [matchMode, setMatchMode] = useState('SPRINT');

  const socketRef = useRef<Socket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const activeProblemRef = useRef(activeProblem);
  activeProblemRef.current = activeProblem;
  const problemsRef = useRef(problems);
  problemsRef.current = problems;

  // Load match problems
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/signin?callbackUrl=/battle/' + matchId);
      return;
    }
    if (authStatus !== 'authenticated') return;

    fetch(`/api/match/${matchId}/problems`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load match');
        return r.json();
      })
      .then((data) => {
        setProblems(data.problems);
        setMatchMode(data.mode || 'SPRINT');
        setTotalProblems(data.totalProblems || 3);
        // Set starter code for first unlocked problem
        const first = data.problems.find((p: Problem) => p.progress.status === 'UNLOCKED');
        if (first) {
          setActiveProblem(data.problems.indexOf(first));
          setCode(first.starterCode[language] || '');
        }
      })
      .catch(() => router.push('/play'));
  }, [matchId, authStatus, router]);

  // Load opponent data
  const loadOpponent = useCallback(() => {
    fetch(`/api/match/${matchId}/opponent`)
      .then((r) => r.json())
      .then((data) => {
        setOpponentProgress(data.opponentProgress || []);
        setScores(data.scores || { player: 0, opponent: 0 });
        setRaceProgress(data.raceProgress || { player: 0, opponent: 0 });
        setSolvedCount(data.solvedCount || { player: 0, opponent: 0 });
        setTotalProblems(data.totalProblems || 3);
        if (data.opponent?.username) {
          setOpponentName(data.opponent.username);
        }
      })
      .catch(() => {});
  }, [matchId]);

  useEffect(() => {
    loadOpponent();
    const interval = setInterval(loadOpponent, 3000);
    return () => clearInterval(interval);
  }, [loadOpponent]);

  // Socket.IO connection
  useEffect(() => {
    if (authStatus !== 'authenticated' || !session?.user) return;

    const socket = io(
      typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.hostname}:3002`
        : 'http://localhost:3002',
      { transports: ['websocket', 'polling'] },
    );

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('match:join', matchId, () => {});
    });

    socket.on('disconnect', () => setSocketConnected(false));

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
      }
      loadOpponent();
    });

    socket.on('opponent:progress' as any, (payload: OpponentSnapshot) => {
      if (payload.raceProgress !== undefined) {
        setRaceProgress((prev) => ({
          ...prev,
          opponent: payload.raceProgress,
        }));
      }
      if (payload.solvedCount !== undefined) {
        setSolvedCount((prev) => ({
          ...prev,
          opponent: payload.solvedCount,
        }));
      }
    });

    socket.on('timer:sync' as any, (payload: { endsAt: string; remainingMs: number }) => {
      setRemainingMs(payload.remainingMs);
    });

    socket.on('match:end' as any, (payload: MatchEndPayload) => {
      setMatchEnd(payload);
    });

    socket.on('problem:unlocked' as any, () => {
      // Reload problems to get updated progress
      fetch(`/api/match/${matchId}/problems`)
        .then((r) => r.json())
        .then((data) => setProblems(data.problems));
    });

    socketRef.current = socket;

    return () => {
      socket.emit('match:leave', matchId);
      socket.disconnect();
    };
  }, [matchId, authStatus, session, loadOpponent]);

  // Timer countdown
  useEffect(() => {
    if (matchEnd) return;

    // Get endsAt from match status
    fetch('/api/match/status')
      .then((r) => r.json())
      .then((data) => {
        if (data.match?.endsAt) {
          const endsAt = new Date(data.match.endsAt).getTime();
          const updateTimer = () => {
            const remaining = Math.max(0, endsAt - Date.now());
            setRemainingMs(remaining);
            if (remaining <= 0) {
              // Time's up - check for match result
              fetch(`/api/match/${matchId}/result`)
                .then((r) => r.json())
                .then((d) => {
                  if (d.match?.status === 'COMPLETED') {
                    setMatchEnd({
                      matchId,
                      status: 'COMPLETED',
                      winnerId: d.match.winnerId,
                      scoreA: d.match.scoreA,
                      scoreB: d.match.scoreB,
                      eloDeltaA: d.match.eloDeltaA,
                      eloDeltaB: d.match.eloDeltaB,
                      reason: 'time',
                    });
                  }
                });
            }
          };
          updateTimer();
          timerRef.current = setInterval(updateTimer, 1000);
        }
      });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [matchId, matchEnd]);

  // Poll for match completion (detects forfeit/early_finish from opponent)
  useEffect(() => {
    if (matchEnd) return;

    const checkCompletion = () => {
      fetch(`/api/match/${matchId}/result`)
        .then((r) => r.json())
        .then((d) => {
          if (d.match?.status === 'COMPLETED') {
            setMatchEnd({
              matchId,
              status: 'COMPLETED',
              winnerId: d.match.winnerId,
              scoreA: d.match.scoreA,
              scoreB: d.match.scoreB,
              eloDeltaA: d.match.eloDeltaA,
              eloDeltaB: d.match.eloDeltaB,
              reason: d.match.endReason || 'unknown',
            });
          }
        })
        .catch(() => {});
    };

    const pollRef = setInterval(checkCompletion, 3000);
    return () => clearInterval(pollRef);
  }, [matchId, matchEnd]);

  // Switch language -> update code
  const switchLanguage = useCallback(
    (lang: LanguageId) => {
      setLanguage(lang);
      const current = problems[activeProblem];
      if (current) {
        setCode(current.starterCode[lang] || '');
      }
    },
    [problems, activeProblem],
  );

  // Switch problem
  const switchProblem = useCallback(
    (idx: number) => {
      const p = problems[idx];
      if (!p || p.progress.status === 'LOCKED') return;
      setActiveProblem(idx);
      setCode(p.starterCode[language] || '');
      setVerdict(null);
    },
    [problems, language],
  );

  // Submit code
  const handleSubmit = useCallback(
    async (mode: 'RUN' | 'SUBMIT') => {
      const current = problems[activeProblem];
      if (!current) return;
      setSubmitting(true);
      setVerdict(null);

      try {
        const res = await fetch(`/api/match/${matchId}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            problemId: current.id,
            language,
            code,
            mode,
          }),
        });

        const data = await res.json();
        if (res.ok) {
          setVerdict({
            verdict: data.verdict,
            passed: data.passed,
            total: data.total,
            error: data.error,
            timeMs: data.timeMs,
            memoryKb: data.memoryKb,
          });
          loadOpponent();

          // If AC on submit, reload problems and advance to next unlocked
          if (mode === 'SUBMIT' && data.verdict === 'AC') {
            const probRes = await fetch(`/api/match/${matchId}/problems`);
            const probData = await probRes.json();
            setProblems(probData.problems);

            // Update race progress for player
            const solvedNow = probData.problems.filter(
              (p: Problem) => p.progress.status === 'SOLVED',
            ).length;
            setSolvedCount((prev) => ({ ...prev, player: solvedNow }));
            setRaceProgress((prev) => ({
              ...prev,
              player: solvedNow / probData.totalProblems,
            }));

            // Check if all problems solved (early finish)
            if (solvedNow >= probData.totalProblems) {
              // Match will be finalized by the submit endpoint
              // Poll for the result
              setTimeout(() => {
                fetch(`/api/match/${matchId}/result`)
                  .then((r) => r.json())
                  .then((d) => {
                    if (d.match?.status === 'COMPLETED') {
                      setMatchEnd({
                        matchId,
                        status: 'COMPLETED',
                        winnerId: d.match.winnerId,
                        scoreA: d.match.scoreA,
                        scoreB: d.match.scoreB,
                        eloDeltaA: d.match.eloDeltaA,
                        eloDeltaB: d.match.eloDeltaB,
                        reason: 'early_finish',
                      });
                    }
                  });
              }, 1000);
              return;
            }

            const nextIdx = probData.problems.findIndex(
              (p: Problem) => p.progress.status === 'UNLOCKED',
            );
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
    },
    [matchId, problems, activeProblem, language, code, loadOpponent],
  );

  // Forfeit
  const handleForfeit = useCallback(async () => {
    if (!confirm('Are you sure you want to forfeit?')) return;
    await fetch(`/api/match/${matchId}/forfeit`, { method: 'POST' });
    router.push('/dashboard');
  }, [matchId, router]);

  // Match end screen
  if (matchEnd) {
    const isWinner = matchEnd.winnerId === session?.user?.id;
    const isDraw = !matchEnd.winnerId;
    const isPlayerA = scores.player === matchEnd.scoreA;
    const myEloDelta = isPlayerA ? matchEnd.eloDeltaA : matchEnd.eloDeltaB;
    const oppEloDelta = isPlayerA ? matchEnd.eloDeltaB : matchEnd.eloDeltaA;

    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <div className="card w-full max-w-md p-8 text-center">
          <div className="mb-4 text-5xl font-bold">
            {isDraw ? (
              <span className="text-warn">DRAW</span>
            ) : isWinner ? (
              <span className="text-ok">VICTORY</span>
            ) : (
              <span className="text-bad">DEFEAT</span>
            )}
          </div>

          <div className="mb-6 space-y-2">
            <div className="text-lg">
              {matchEnd.scoreA} — {matchEnd.scoreB}
            </div>
            <div className="text-sm text-gray-400">
              {solvedCount.player}/{totalProblems} solved vs {solvedCount.opponent}/{totalProblems}
            </div>
            <div className="text-xs text-gray-500">
              {matchEnd.reason === 'early_finish' ? 'Race finished!' : matchEnd.reason === 'forfeit' ? 'Opponent forfeited' : matchEnd.reason === 'time' ? 'Time ran out' : 'Match ended'}
            </div>
          </div>

          <div className="mb-6 flex justify-center gap-8">
            <div className="text-center">
              <div className="text-sm text-gray-400">Your ELO</div>
              <div className={`text-xl font-bold ${myEloDelta > 0 ? 'text-ok' : myEloDelta < 0 ? 'text-bad' : 'text-gray-400'}`}>
                {myEloDelta > 0 ? '+' : ''}{myEloDelta}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-400">Opponent ELO</div>
              <div className={`text-xl font-bold ${oppEloDelta > 0 ? 'text-ok' : oppEloDelta < 0 ? 'text-bad' : 'text-gray-400'}`}>
                {oppEloDelta > 0 ? '+' : ''}{oppEloDelta}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => router.push('/play')} className="btn-primary flex-1">
              Play Again
            </button>
            <button onClick={() => router.push('/dashboard')} className="btn-ghost flex-1">
              Dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (problems.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="text-gray-400">Loading battle...</div>
      </div>
    );
  }

  const currentProblem = problems[activeProblem] ?? problems[0];
  if (!currentProblem) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="text-gray-400">Loading problems...</div>
      </div>
    );
  }
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  const timeWarning = remainingMs < 300000; // last 5 minutes

  return (
    <main className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Race track at top */}
      <div className="border-b border-white/5 bg-bg-card">
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

      {/* Top bar — problem tabs + timer */}
      <div className="flex h-10 items-center justify-between border-b border-white/5 bg-bg-card px-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-accent">BATTLE</span>
          <div className="flex gap-1">
            {problems.map((p, i) => {
              const isSolved = p.progress.status === 'SOLVED';
              const isCurrent = i === activeProblem;
              const isLocked = p.progress.status === 'LOCKED';
              return (
                <button
                  key={p.id}
                  onClick={() => switchProblem(i)}
                  disabled={isLocked}
                  className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                    isCurrent
                      ? 'bg-accent/20 text-accent'
                      : isSolved
                      ? 'bg-ok/10 text-ok'
                      : isLocked
                      ? 'cursor-not-allowed text-gray-600'
                      : 'text-gray-400 hover:bg-bg-elev'
                  }`}
                >
                  {isSolved ? '✓' : i + 1}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-xs text-gray-500">
            Score: <span className="font-bold text-white">{scores.player}</span>
            {' vs '}
            <span className="font-bold text-gray-400">{scores.opponent}</span>
          </div>
          <div
            className={`font-mono text-sm font-bold ${
              timeWarning ? 'text-bad animate-pulse-fast' : 'text-gray-300'
            }`}
          >
            {timeStr}
          </div>
          <button onClick={handleForfeit} className="text-xs text-gray-600 hover:text-bad transition-colors">
            Forfeit
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: problem description */}
        <div className="flex w-1/2 flex-col border-r border-white/5">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
            <div>
              <span className="text-sm font-bold text-white">
                {currentProblem.title}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              {currentProblem.points} pts · {currentProblem.timeLimitMs}ms · {currentProblem.memoryLimitMb}MB
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 text-sm leading-relaxed text-gray-300">
            <ReactMarkdown
              components={{
                h2: ({ children }) => <h2 className="text-xl font-bold mt-6 mb-3">{children}</h2>,
                h3: ({ children }) => <h3 className="text-lg font-bold mt-4 mb-2">{children}</h3>,
                strong: ({ children }) => <strong>{children}</strong>,
                code: ({ children }) => <code className="rounded bg-bg-elev px-1 py-0.5 text-accent">{children}</code>,
                li: ({ children }) => <li className="ml-4">{children}</li>,
              }}
            >
              {currentProblem.descriptionMd}
            </ReactMarkdown>
          </div>
        </div>

        {/* Right panel: editor + output */}
        <div className="flex flex-1 flex-col">
          {/* Editor toolbar */}
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
            <div className="flex items-center gap-2">
              {(Object.keys(LANG_LABELS) as LanguageId[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => switchLanguage(lang)}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    language === lang
                      ? 'bg-accent/20 text-accent'
                      : 'text-gray-400 hover:bg-bg-elev'
                  }`}
                >
                  {LANG_LABELS[lang]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSubmit('RUN')}
                disabled={submitting || currentProblem.progress.status === 'LOCKED' || currentProblem.progress.status === 'SOLVED'}
                className="btn-ghost text-xs"
              >
                {submitting ? 'Running...' : 'Run'}
              </button>
              <button
                onClick={() => handleSubmit('SUBMIT')}
                disabled={submitting || currentProblem.progress.status === 'LOCKED' || currentProblem.progress.status === 'SOLVED'}
                className="btn-primary text-xs"
              >
                {submitting ? 'Judging...' : 'Submit'}
              </button>
            </div>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1">
            <MonacoEditor
              height="100%"
              language={language === 'cpp' ? 'cpp' : language}
              theme="vs-dark"
              value={code}
              onChange={(v) => setCode(v ?? '')}
              options={{
                fontSize: 14,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                minimap: { enabled: false },
                padding: { top: 12 },
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </div>

          {/* Output panel */}
          <div className="h-48 border-t border-white/5">
            <div className="flex border-b border-white/5">
              <button
                onClick={() => setOutputTab('description')}
                className={`px-4 py-1.5 text-xs font-medium ${
                  outputTab === 'description'
                    ? 'border-b-2 border-accent text-accent'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Problem Info
              </button>
              <button
                onClick={() => setOutputTab('result')}
                className={`px-4 py-1.5 text-xs font-medium ${
                  outputTab === 'result'
                    ? 'border-b-2 border-accent text-accent'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Output {verdict && `(${verdict.verdict})`}
              </button>
            </div>
            <div className="h-[calc(100%-2rem)] overflow-y-auto p-3 font-mono text-xs">
              {outputTab === 'description' ? (
                <div className="space-y-1 text-gray-400">
                  <div>Language: {LANG_LABELS[language]}</div>
                  <div>Time limit: {currentProblem.timeLimitMs}ms</div>
                  <div>Memory limit: {currentProblem.memoryLimitMb}MB</div>
                  <div>Wrong submissions: {currentProblem.progress.wrongSubmissions}</div>
                  {currentProblem.progress.status === 'SOLVED' && (
                    <div className="text-ok">SOLVED — {currentProblem.progress.scoreEarned} pts</div>
                  )}
                  {currentProblem.progress.status === 'LOCKED' && (
                    <div className="text-bad">LOCKED — solve the previous problem first</div>
                  )}
                </div>
              ) : verdict ? (
                <div className="space-y-1">
                  <div
                    className={`font-bold ${
                      verdict.verdict === 'AC' ? 'text-ok' : 'text-bad'
                    }`}
                  >
                    {verdict.verdict} — {verdict.passed}/{verdict.total} test cases passed
                  </div>
                  {verdict.timeMs != null && (
                    <div className="text-gray-400">Time: {verdict.timeMs}ms</div>
                  )}
                  {verdict.memoryKb != null && (
                    <div className="text-gray-400">Memory: {verdict.memoryKb}KB</div>
                  )}
                  {verdict.error && (
                    <pre className="mt-2 whitespace-pre-wrap text-bad/80">{verdict.error}</pre>
                  )}
                </div>
              ) : (
                <div className="text-gray-600">Run or submit to see output</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
