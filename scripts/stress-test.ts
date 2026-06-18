/**
 * Stress Test — simulates N concurrent users to measure system capacity.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 pnpm tsx scripts/stress-test.ts
 *   USERS=50 DURATION=60 pnpm tsx scripts/stress-test.ts
 *
 * Environment variables:
 *   BASE_URL  — target server (default: http://localhost:3000)
 *   USERS     — number of virtual users (default: 100)
 *   DURATION  — test duration in seconds (default: 120)
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const NUM_USERS = parseInt(process.env.USERS || '100', 10);
const DURATION_S = parseInt(process.env.DURATION || '120', 10);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Simple C++ solution for CSES problems (just reads input and outputs something)
const SOLUTION = `#include <bits/stdc++.h>
using namespace std;
int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int n;
    cin >> n;
    vector<int> a(n);
    for (int i = 0; i < n; i++) cin >> a[i];
    cout << *max_element(a.begin(), a.end()) << endl;
    return 0;
}`;

interface Stats {
  signup: number[];
  signIn: number[];
  joinQueue: number[];
  matchFound: number[];
  submission: number[];
  errors: number;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function api(path: string, opts?: RequestInit): Promise<{ status: number; data: any }> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts?.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function signIn(email: string, password: string): Promise<string | null> {
  try {
    const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
    const { csrfToken } = await csrfRes.json();
    const csrfCookies = csrfRes.headers.getSetCookie();

    const jar: Record<string, string> = {};
    for (const c of csrfCookies) {
      const [kv] = c.split(';');
      const [k, v] = kv.split('=');
      jar[k] = v;
    }

    const form = new URLSearchParams();
    form.set('email', email);
    form.set('password', password);
    form.set('csrfToken', csrfToken);
    form.set('callbackUrl', `${BASE}/play`);

    const signInRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: Object.entries(jar)
          .map(([k, v]) => `${k}=${v}`)
          .join('; '),
      },
      body: form.toString(),
      redirect: 'manual',
    });

    for (const c of signInRes.headers.getSetCookie()) {
      const [kv] = c.split(';');
      const [k, v] = kv.split('=');
      jar[k] = v;
    }

    const cookie = Object.entries(jar)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    return cookie;
  } catch {
    return null;
  }
}

async function virtualUser(
  id: number,
  stats: Stats,
  stopTime: number,
): Promise<void> {
  const email = `stress-test-${id}@zapdos.test`;
  const password = 'testpass123';

  // 1. Sign up (ignore errors if exists)
  const t0 = Date.now();
  await api('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, username: `stress${id}` }),
  });
  stats.signup.push(Date.now() - t0);

  // 2. Sign in
  const t1 = Date.now();
  const cookie = await signIn(email, password);
  stats.signIn.push(Date.now() - t1);
  if (!cookie) {
    stats.errors++;
    return;
  }

  // 3. Join queue
  const t2 = Date.now();
  const joinRes = await api('/api/match/join', {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { Cookie: cookie },
  });
  stats.joinQueue.push(Date.now() - t2);

  if (joinRes.status !== 200) {
    stats.errors++;
    return;
  }

  // 4. Wait for match (poll status)
  const t3 = Date.now();
  let matchId: string | null = null;
  for (let i = 0; i < 60; i++) {
    if (Date.now() > stopTime) break;
    await sleep(2000);

    const statusRes = await api('/api/match/status', {
      headers: { Cookie: cookie },
    });

    if (statusRes.data?.status === 'in_match') {
      matchId = statusRes.data.match?.id;
      break;
    }

    // If kicked from queue or errored, rejoin
    if (statusRes.data?.status === 'idle' || statusRes.data?.status === 'error') {
      await api('/api/match/join', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { Cookie: cookie },
      });
    }
  }

  stats.matchFound.push(Date.now() - t3);

  if (!matchId) {
    // No match found within timeout — count as timeout, not error
    return;
  }

  // 5. Get problems
  const probRes = await api(`/api/match/${matchId}/problems`, {
    headers: { Cookie: cookie },
  });

  if (!probRes.data?.problems) {
    stats.errors++;
    return;
  }

  // 6. Submit first unlocked problem
  const problem = probRes.data.problems.find(
    (p: any) => p.progress?.status === 'UNLOCKED',
  );
  if (!problem) return;

  const t4 = Date.now();
  await api(`/api/match/${matchId}/submit`, {
    method: 'POST',
    body: JSON.stringify({
      problemId: problem.id,
      language: 'cpp',
      code: SOLUTION,
      mode: 'SUBMIT',
    }),
    headers: { Cookie: cookie },
  });
  stats.submission.push(Date.now() - t4);

  // 7. Forfeit to free resources
  await api(`/api/match/${matchId}/forfeit`, {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { Cookie: cookie },
  });
}

function printStats(stats: Stats): void {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║              STRESS TEST RESULTS                ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  const sections: [string, number[]][] = [
    ['Signup', stats.signup],
    ['Sign-in', stats.signIn],
    ['Join Queue', stats.joinQueue],
    ['Match Found (wait)', stats.matchFound],
    ['Submission', stats.submission],
  ];

  console.log(`${'Operation'.padEnd(20)} ${'p50'.padStart(8)} ${'p95'.padStart(8)} ${'p99'.padStart(8)} ${'count'.padStart(8)}`);
  console.log('─'.repeat(56));

  for (const [name, data] of sections) {
    if (data.length === 0) continue;
    const p50 = percentile(data, 50);
    const p95 = percentile(data, 95);
    const p99 = percentile(data, 99);
    console.log(
      `${name.padEnd(20)} ${`${p50}ms`.padStart(8)} ${`${p95}ms`.padStart(8)} ${`${p99}ms`.padStart(8)} ${String(data.length).padStart(8)}`,
    );
  }

  console.log('\n─'.repeat(56));
  console.log(`Total errors: ${stats.errors}`);
  console.log(`Users attempted: ${NUM_USERS}`);
  console.log(`Test duration: ${DURATION_S}s`);
}

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║            ZAPDOS STRESS TEST                   ║');
  console.log('╚══════════════════════════════════════════════════╝\n');
  console.log(`Target:     ${BASE}`);
  console.log(`Users:      ${NUM_USERS}`);
  console.log(`Duration:   ${DURATION_S}s`);

  // Verify server is up
  try {
    const health = await api('/api/health');
    if (health.data?.status !== 'ok') {
      console.error('✗ Server health check failed:', health.data);
      process.exit(1);
    }
    console.log('✓ Server is healthy\n');
  } catch (err) {
    console.error('✗ Cannot reach server:', (err as Error).message);
    process.exit(1);
  }

  const stats: Stats = {
    signup: [],
    signIn: [],
    joinQueue: [],
    matchFound: [],
    submission: [],
    errors: 0,
  };

  const stopTime = Date.now() + DURATION_S * 1000;

  // Launch virtual users in batches to avoid overwhelming the server
  const BATCH_SIZE = 20;
  const totalBatches = Math.ceil(NUM_USERS / BATCH_SIZE);

  for (let batch = 0; batch < totalBatches; batch++) {
    const start = batch * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, NUM_USERS);
    const batchUsers = [];

    for (let i = start; i < end; i++) {
      batchUsers.push(virtualUser(i, stats, stopTime));
    }

    process.stdout.write(`  Launching users ${start + 1}-${end}...`);
    await Promise.allSettled(batchUsers);
    console.log(' done');

    // Brief pause between batches
    if (batch < totalBatches - 1) {
      await sleep(1000);
    }
  }

  // Wait a bit for stragglers
  await sleep(5000);

  // Check health again
  const health = await api('/api/health');
  console.log(`\nFinal health: ${health.data?.status ?? 'unknown'}`);

  printStats(stats);
}

main().catch((err) => {
  console.error('\n✗ FATAL:', err.message);
  process.exit(1);
});
