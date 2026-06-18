'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { io, Socket } from 'socket.io-client';
import type { MatchEndPayload, SubmissionVerdictPayload, OpponentSnapshot } from '@cp-battle/realtime';
import { useCountdown } from '@/lib/useCountdown';
import { BattleHUD } from '@/components/battle/BattleHUD';
import { ProblemPanel } from '@/components/battle/ProblemPanel';
import { EditorPanel } from '@/components/battle/EditorPanel';
import { OutputPanel } from '@/components/battle/OutputPanel';
import { MatchEndScreen } from '@/components/battle/MatchEndScreen';
import { LoadingSpinner } from '@/components/LoadingSpinner';

type LanguageId = 'cpp' | 'python' | 'java';

interface Problem {
  id: string;
  title: string;
  descriptionMd: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  points: number;
  progress: { status: string; wrongSubmissions: number; scoreEarned: number };
}

const DEFAULT_CODE: Record<LanguageId, string> = {
  cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    cout << "Hello World" << endl;\n    return 0;\n}\n`,
  python: `print("Hello World")\n`,
  java: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello World");\n    }\n}\n`,
};

interface VerdictResult {
  verdict: string;
  passed: number;
  total: number;
  error?: string;
  timeMs?: number;
  memoryKb?: number;
}

interface Props {
  params: Promise<{ matchId: string }>;
}

export default function BattlePage({ params }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const [matchId, setMatchId] = useState<string>('');
  const [problems, setProblems] = useState<Problem[]>([]);
  const [activeProblem, setActiveProblem] = useState(0);
  const [language, setLanguage] = useState<LanguageId>('cpp');
  const [code, setCode] = useState(DEFAULT_CODE.cpp);
  const [scores, setScores] = useState({ player: 0, opponent: 0 });
  const [verdict, setVerdict] = useState<VerdictResult | null>(null);
  const [matchEnd, setMatchEnd] = useState<MatchEndPayload | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [outputTab, setOutputTab] = useState<'result' | 'description'>('description');
  const [showConfetti, setShowConfetti] = useState(false);
  const [displayElo, setDisplayElo] = useState(0);
  const [eloDelta, setEloDelta] = useState(0);

  const isPractice = matchId.startsWith('practice-');
  const practiceDifficulty = isPractice ? matchId.replace('practice-', '') : '';

  const socketRef = useRef<Socket | null>(null);
  const languageRef = useRef(language);
  const activeProblemRef = useRef(activeProblem);
  const problemsRef = useRef(problems);
  const [opponentUserId, setOpponentUserId] = useState<string | null>(null);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    activeProblemRef.current = activeProblem;
  }, [activeProblem]);

  useEffect(() => {
    problemsRef.current = problems;
  }, [problems]);

  useEffect(() => {
    params.then((p) => setMatchId(p.matchId));
  }, [params]);

  // Load saved code for this match
  useEffect(() => {
    if (!matchId) return;
    const key = `cpbattle-code-${matchId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { language?: LanguageId; code?: string; activeProblem?: number };
        if (parsed.language) setLanguage(parsed.language);
        if (parsed.code) setCode(parsed.code);
        if (typeof parsed.activeProblem === 'number') setActiveProblem(parsed.activeProblem);
      } catch { /* ignore */ }
    }
  }, [matchId]);

  // Save code on change
  useEffect(() => {
    if (!matchId) return;
    const key = `cpbattle-code-${matchId}`;
    localStorage.setItem(key, JSON.stringify({ language, code, activeProblem }));
  }, [matchId, language, code, activeProblem]);

  const { timeStr, timeWarning, isFinished } = useCountdown(matchId);

  useEffect(() => {
    if (isFinished && !matchEnd) {
      setMatchEnd({
        matchId,
        status: 'COMPLETED',
        winnerId: null,
        reason: 'time',
        scoreA: scores.player,
        scoreB: scores.opponent,
        eloDeltaA: 0,
        eloDeltaB: 0,
      });
    }
  }, [isFinished, matchEnd, matchId, scores]);

  useEffect(() => {
    if (!matchId || !session?.user?.id) return;
    const userId = session.user.id;
    const displayName = session.user.name || session.user.email || 'Player';

    const socket = io({
      path: '/api/socketio',
      transports: ['websocket', 'polling'],
      query: {
        matchId,
        userId,
        displayName,
        isPractice: matchId.startsWith('practice-'),
      },
    });
    socketRef.current = socket;

    socket.on('connect_error', () => {
      // Reconnection handled by Socket.IO automatically
    });

    socket.on('opponent:progress', (data: OpponentSnapshot) => {
      if (data.userId === userId) {
        setScores(prev => ({ ...prev, player: data.score }));
      } else {
        setScores(prev => ({ ...prev, opponent: data.score }));
        setOpponentUserId(data.userId);
      }
    });

    socket.on('submission:verdict', (data: SubmissionVerdictPayload) => {
      setVerdict({ verdict: data.verdict, passed: data.passed, total: data.total, error: data.error, timeMs: data.timeMs ?? undefined, memoryKb: data.memoryKb ?? undefined });
      setIsSubmitting(false);
      setOutputTab('result');
    });

    socket.on('match:end', (data: MatchEndPayload) => {
      setMatchEnd(data);
      const elo = data.scoreA > data.scoreB ? data.eloDeltaA : data.eloDeltaB;
      setDisplayElo(elo);
      if (data.scoreA > data.scoreB) {
        setEloDelta(data.eloDeltaA);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 4000);
      } else if (data.scoreA < data.scoreB) {
        setEloDelta(data.eloDeltaA);
      } else {
        setEloDelta(0);
      }
    });

    socket.on('problem:unlocked', () => {
      // Problem list will be refreshed via fetch or next submission
    });

    return () => {
      socket.emit('match:leave', matchId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [matchId, session?.user?.id, session?.user?.name, session?.user?.email]);

  const currentProblem = problems[activeProblem];

  const handleLanguageChange = useCallback((lang: LanguageId) => {
    setLanguage(lang);
    if (!isSubmitting) {
      setCode(DEFAULT_CODE[lang]);
    }
  }, [isSubmitting]);

  const handleRun = useCallback(async () => {
    if (!currentProblem || isSubmitting) return;
    setIsSubmitting(true);
    setOutputTab('result');
    try {
      const res = await fetch('/api/judge/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          problemId: currentProblem.id,
          language,
          code,
        }),
      });
      const data = await res.json();
      setVerdict({ verdict: data.verdict || data.error, passed: data.passed ?? 0, total: data.total ?? 0, error: data.error, timeMs: data.timeMs, memoryKb: data.memoryKb });
      setOutputTab('result');
    } catch {
      setVerdict({ verdict: 'ERROR', passed: 0, total: 0, error: 'Request failed' });
    } finally {
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
        }),
      });
      const data = await res.json();
      if (data.error) {
        setVerdict({ verdict: 'ERROR', passed: 0, total: 0, error: data.error });
        setIsSubmitting(false);
      }
      // Verdict arrives via socket
    } catch {
      setVerdict({ verdict: 'ERROR', passed: 0, total: 0, error: 'Request failed' });
      setIsSubmitting(false);
    }
  }, [currentProblem, isSubmitting, matchId, language, code]);

  const handleForfeit = useCallback(async () => {
    if (!confirm('Forfeit this match?')) return;
    try {
      await fetch(`/api/match/${matchId}/forfeit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code }),
      });
    } catch { /* ignore */ }
  }, [matchId, language, code]);

  useEffect(() => {
    if (!socketRef.current || !matchId || !session?.user?.id) return;
    const socket = socketRef.current;

    return () => {
      socket.off('opponent:progress');
      socket.off('submission:verdict');
      socket.off('match:end');
      socket.off('problem:unlocked');
      socket.off('timer:sync');
    };
  }, [matchId, session?.user?.id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'r' && !e.shiftKey) {
        e.preventDefault();
        handleRun();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRun, handleSubmit]);

  // Warning on leave
  useEffect(() => {
    if (matchEnd || isPractice) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [matchEnd, isPractice]);

  if (matchEnd) {
    return (
      <MatchEndScreen
        matchEnd={matchEnd}
        myUserId={session?.user?.id || ''}
        isPractice={isPractice}
        practiceDifficulty={practiceDifficulty}
        eloDelta={eloDelta}
        displayElo={displayElo}
        showConfetti={showConfetti}
        solvedCount={{
          player: matchEnd.scoreA,
          opponent: matchEnd.scoreB,
        }}
        totalProblems={problems.length}
        onRematch={() => router.push('/play')}
        onDashboard={() => router.push('/dashboard')}
      />
    );
  }

  if (!currentProblem) {
    return (
      <main className="flex h-[calc(100vh-2.25rem)] items-center justify-center">
        <LoadingSpinner label="loading match..." />
      </main>
    );
  }

  return (
    <main id="main-content" className="h-[calc(100vh-2.25rem)] flex flex-col">
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
        isPractice={isPractice}
        onSwitchProblem={setActiveProblem}
        onForfeit={handleForfeit}
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
    </main>
  );
}
