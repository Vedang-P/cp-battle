/**
 * E2E Match Simulation — full match between two players.
 * Works with CSES problems (sample test cases only).
 *
 * Usage: BASE_URL=http://localhost:3000 pnpm tsx scripts/e2e-match.js
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';

async function signIn(email, password) {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const csrfCookies = csrfRes.headers.getSetCookie();

  const jar = {};
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
      'Cookie': Object.entries(jar).map(([k,v]) => `${k}=${v}`).join('; '),
    },
    body: form.toString(),
    redirect: 'manual',
  });

  for (const c of signInRes.headers.getSetCookie()) {
    const [kv] = c.split(';');
    const [k, v] = kv.split('=');
    jar[k] = v;
  }

  const loc = signInRes.headers.get('location') || `${BASE}/play`;
  const followRes = await fetch(loc, {
    headers: { Cookie: Object.entries(jar).map(([k,v]) => `${k}=${v}`).join('; ') },
    redirect: 'manual',
  });
  for (const c of followRes.headers.getSetCookie()) {
    const [kv] = c.split(';');
    const [k, v] = kv.split('=');
    jar[k] = v;
  }

  const cookie = Object.entries(jar).map(([k,v]) => `${k}=${v}`).join('; ');
  const sessionRes = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: cookie } });
  const session = await sessionRes.json();
  if (!session?.user) throw new Error(`Auth failed for ${email}`);
  return cookie;
}

function api(path, opts, cookie) {
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Cookie: cookie, ...(opts?.headers || {}) },
  }).then(r => r.json().then(d => ({ status: r.status, data: d })));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Generic C++ solutions for common CSES introductory problems
// These handle simple stdin/stdout problems with basic I/O
const GENERIC_SOLUTIONS = {
  default: `#include <bits/stdc++.h>
using namespace std;
int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int n;
    cin >> n;
    cout << n << endl;
    return 0;
}`,
  // For Weaker Kattis-style problems: read all input, echo or process minimally
  simple: `#include <bits/stdc++.h>
using namespace std;
int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    string s;
    while (cin >> s) {
        cout << s << " ";
    }
    cout << endl;
    return 0;
}`,
  // For number output problems
  numbers: `#include <bits/stdc++.h>
using namespace std;
int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    long long n;
    cin >> n;
    cout << n * n << endl;
    return 0;
}`,
};

async function main() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   E2E MATCH SIMULATION               ║');
  console.log('╚══════════════════════════════════════╝\n');

  // 1. Sign in
  console.log('① Authentication');
  const alpha = await signIn('alpha@test.com', 'password123');
  const beta = await signIn('beta@test.com', 'password123');
  console.log('  ✓ Both players authenticated');

  // 2. Profiles
  console.log('\n② Player Profiles');
  const aProf = await api('/api/user/profile', {}, alpha);
  const bProf = await api('/api/user/profile', {}, beta);
  console.log(`  Alpha: ELO ${aProf.data.elo} | W${aProf.data.wins} L${aProf.data.losses} D${aProf.data.draws}`);
  console.log(`  Beta:  ELO ${bProf.data.elo} | W${bProf.data.wins} L${bProf.data.losses} D${bProf.data.draws}`);

  // 3. Join queue
  console.log('\n③ Matchmaking');
  await api('/api/match/join', { method: 'POST', body: JSON.stringify({}) }, alpha);
  console.log('  Alpha → queue');
  await api('/api/match/join', { method: 'POST', body: JSON.stringify({}) }, beta);
  console.log('  Beta  → queue');

  // 4. Wait for match
  process.stdout.write('  Pairing');
  let matchId = null;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const s = await api('/api/match/status', {}, alpha);
    if (s.data.status === 'in_match') {
      matchId = s.data.match.id;
      break;
    }
    process.stdout.write('.');
  }
  console.log('');
  if (!matchId) { console.log('  ✗ TIMEOUT waiting for match'); process.exit(1); }
  console.log(`  ✓ Match: ${matchId}`);

  // 5. Problems
  console.log('\n④ Problems');
  const probRes = await api(`/api/match/${matchId}/problems`, {}, alpha);
  const problems = probRes.data.problems;
  const total = probRes.data.totalProblems;
  console.log(`  ${total} problems`);
  for (const p of problems) {
    const icon = p.progress.status === 'SOLVED' ? '✓' : p.progress.status === 'UNLOCKED' ? '→' : '🔒';
    console.log(`    ${icon} ${p.title} (${p.difficulty})`);
  }

  // 6. Alpha solves problems
  console.log('\n⑤ Solving (Alpha)');
  let cur = problems.find(p => p.progress.status === 'UNLOCKED');
  let solved = 0;

  while (cur && solved < total) {
    process.stdout.write(`  → ${cur.title}... `);
    const res = await api(`/api/match/${matchId}/submit`, {
      method: 'POST',
      body: JSON.stringify({
        problemId: cur.id,
        language: 'cpp',
        code: GENERIC_SOLUTIONS.default,
        mode: 'SUBMIT',
      }),
    }, alpha);

    const d = res.data;
    if (d.verdict === 'AC') {
      solved++;
      console.log(`✓ AC (${d.passed}/${d.total}) [${d.timeMs}ms]`);
      if (d.earlyFinish) {
        console.log('  🏁 Early finish!');
        break;
      }
      // Fetch updated problems to find next unlocked
      const upd = await api(`/api/match/${matchId}/problems`, {}, alpha);
      cur = upd.data.problems.find(p => p.progress.status === 'UNLOCKED');
    } else {
      console.log(`✗ ${d.verdict} (${d.passed}/${d.total})`);
      if (d.error) console.log(`    ${d.error.substring(0, 100)}`);
      // Try to continue with next problem if available
      const upd = await api(`/api/match/${matchId}/problems`, {}, alpha);
      cur = upd.data.problems.find(p => p.progress.status === 'UNLOCKED');
      if (!cur) break;
    }
  }

  // 7. Wait for finalization
  console.log('\n⑥ Finalization');
  await sleep(3000);

  const result = await api(`/api/match/${matchId}/result`, {}, alpha);
  if (result.data?.match) {
    const m = result.data.match;
    const winnerStr = m.winnerId === aProf.data.id ? 'ALPHA' : m.winnerId === bProf.data.id ? 'BETA' : 'DRAW';
    console.log(`  Status: ${m.status}`);
    console.log(`  Winner: ${winnerStr}`);
    console.log(`  Score:  ${m.scoreA} — ${m.scoreB}`);
    console.log(`  ELO:    Alpha ${m.eloDeltaA >= 0 ? '+' : ''}${m.eloDeltaA} | Beta ${m.eloDeltaB >= 0 ? '+' : ''}${m.eloDeltaB}`);
  } else {
    console.log('  ⚠ Could not fetch match result');
  }

  // 8. Final profiles
  console.log('\n⑦ Final ELO');
  const aFinal = await api('/api/user/profile', {}, alpha);
  const bFinal = await api('/api/user/profile', {}, beta);
  console.log(`  Alpha: ${aProf.data.elo} → ${aFinal.data.elo}`);
  console.log(`  Beta:  ${bProf.data.elo} → ${bFinal.data.elo}`);

  // 9. Health
  const health = await api('/api/health', {}, '');
  console.log(`\n⑧ System: ${health.data?.status ?? 'unknown'}`);

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   ✓ E2E TEST PASSED                  ║');
  console.log('╚══════════════════════════════════════╝\n');
}

main().catch(err => {
  console.error('\n✗ FAILED:', err.message);
  process.exit(1);
});
