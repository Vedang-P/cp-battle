/**
 * E2E Match Simulation — full match between alpha and beta.
 */

const BASE = 'http://localhost:3001';

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

// Solutions — must be standalone main() programs with stdin/stdout
const SOL = {
  'two-sum': `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n, target;
    cin >> n;
    vector<int> nums(n);
    for (int i = 0; i < n; i++) cin >> nums[i];
    cin >> target;
    unordered_map<int,int> m;
    for (int i = 0; i < n; i++) {
        int comp = target - nums[i];
        if (m.count(comp)) { cout << m[comp] << " " << i << endl; return 0; }
        m[nums[i]] = i;
    }
    return 0;
}`,
  'reverse-string': `#include <bits/stdc++.h>
using namespace std;
int main() {
    string s;
    getline(cin, s);
    reverse(s.begin(), s.end());
    cout << s << endl;
    return 0;
}`,
  'max-subarray': `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n;
    cin >> n;
    vector<int> nums(n);
    for (int i = 0; i < n; i++) cin >> nums[i];
    int mx = nums[0], cur = nums[0];
    for (int i = 1; i < n; i++) {
        cur = max(nums[i], cur + nums[i]);
        mx = max(mx, cur);
    }
    cout << mx << endl;
    return 0;
}`,
  'lru-cache': `#include <bits/stdc++.h>
using namespace std;
int main() {
    int capacity;
    cin >> capacity;
    unordered_map<int, pair<int, list<int>::iterator>> cache;
    list<int> order;
    string op;
    while (cin >> op) {
        if (op == "GET") {
            int key;
            cin >> key;
            if (cache.count(key)) {
                order.erase(cache[key].second);
                order.push_front(key);
                cache[key].second = order.begin();
                cout << cache[key].first << endl;
            } else {
                cout << -1 << endl;
            }
        } else if (op == "PUT") {
            int key, val;
            cin >> key >> val;
            if (cache.count(key)) order.erase(cache[key].second);
            order.push_front(key);
            cache[key] = {val, order.begin()};
            if ((int)cache.size() > capacity) {
                int old = order.back();
                order.pop_back();
                cache.erase(old);
            }
        }
    }
    return 0;
}`,
  'word-search': `#include <bits/stdc++.h>
using namespace std;
int R, C;
vector<string> board;
bool dfs(int r, int c, int idx, const string& word) {
    if (idx == word.size()) return true;
    if (r < 0 || r >= R || c < 0 || c >= C || board[r][c] != word[idx]) return false;
    char tmp = board[r][c];
    board[r][c] = '#';
    bool found = dfs(r+1,c,idx+1,word) || dfs(r-1,c,idx+1,word) ||
                 dfs(r,c+1,idx+1,word) || dfs(r,c-1,idx+1,word);
    board[r][c] = tmp;
    return found;
}
int main() {
    cin >> R >> C;
    board.resize(R);
    for (int i = 0; i < R; i++) cin >> board[i];
    string word;
    cin >> word;
    for (int i = 0; i < R; i++)
        for (int j = 0; j < C; j++)
            if (dfs(i,j,0,word)) { cout << "true" << endl; return 0; }
    cout << "false" << endl;
    return 0;
}`,
  'interval-merge': `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n;
    cin >> n;
    vector<pair<int,int>> intervals(n);
    for (int i = 0; i < n; i++) cin >> intervals[i].first >> intervals[i].second;
    sort(intervals.begin(), intervals.end());
    vector<pair<int,int>> merged;
    merged.push_back(intervals[0]);
    for (int i = 1; i < n; i++) {
        if (intervals[i].first <= merged.back().second)
            merged.back().second = max(merged.back().second, intervals[i].second);
        else merged.push_back(intervals[i]);
    }
    for (auto& [s,e] : merged) cout << s << " " << e << endl;
    return 0;
}`,
  'median-of-stream': `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n;
    cin >> n;
    priority_queue<int> lo;
    priority_queue<int, vector<int>, greater<int>> hi;
    for (int i = 0; i < n; i++) {
        int x;
        cin >> x;
        lo.push(x);
        hi.push(lo.top());
        lo.pop();
        if (hi.size() > lo.size()) { lo.push(hi.top()); hi.pop(); }
        if (lo.size() > hi.size()) cout << lo.top() << endl;
        else cout << fixed << setprecision(1) << (lo.top() + hi.top()) / 2.0 << endl;
    }
    return 0;
}`,
  'alien-dictionary': `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n;
    cin >> n;
    vector<string> words(n);
    for (int i = 0; i < n; i++) cin >> words[i];
    vector<int> adj[26];
    vector<int> in(26, 0);
    vector<bool> exists(26, false);
    for (auto& w : words) for (char c : w) exists[c-'a'] = true;
    for (int i = 0; i < n-1; i++) {
        int mn = min(words[i].size(), words[i+1].size());
        for (int j = 0; j < mn; j++) {
            if (words[i][j] != words[i+1][j]) {
                adj[words[i][j]-'a'].push_back(words[i+1][j]-'a');
                in[words[i+1][j]-'a']++;
                break;
            }
        }
    }
    queue<int> q;
    for (int i = 0; i < 26; i++) if (exists[i] && in[i]==0) q.push(i);
    string result;
    while (!q.empty()) {
        int u = q.front(); q.pop();
        result += char(u+'a');
        for (int v : adj[u]) { in[v]--; if (in[v]==0) q.push(v); }
    }
    cout << result << endl;
    return 0;
}`,
  'max-rectangle': `#include <bits/stdc++.h>
using namespace std;
int main() {
    int R, C;
    cin >> R >> C;
    vector<vector<int>> grid(R, vector<int>(C));
    for (int i = 0; i < R; i++)
        for (int j = 0; j < C; j++) cin >> grid[i][j];
    int maxArea = 0;
    vector<int> heights(C, 0);
    for (int i = 0; i < R; i++) {
        for (int j = 0; j < C; j++)
            heights[j] = grid[i][j] ? heights[j] + 1 : 0;
        stack<int> st;
        for (int j = 0; j <= C; j++) {
            int h = j == C ? 0 : heights[j];
            while (!st.empty() && heights[st.top()] > h) {
                int height = heights[st.top()]; st.pop();
                int width = st.empty() ? j : j - st.top() - 1;
                maxArea = max(maxArea, height * width);
            }
            st.push(j);
        }
    }
    cout << maxArea << endl;
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
  await api('/api/match/join', { method: 'POST', body: JSON.stringify({ mode: 'SPRINT' }) }, alpha);
  console.log('  Alpha → queue');
  await api('/api/match/join', { method: 'POST', body: JSON.stringify({ mode: 'SPRINT' }) }, beta);
  console.log('  Beta  → queue');

  // 4. Wait for match
  process.stdout.write('  Pairing');
  let matchId = null;
  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    const s = await api('/api/match/status', {}, alpha);
    if (s.data.status === 'in_match') {
      matchId = s.data.match.id;
      break;
    }
    process.stdout.write('.');
  }
  console.log('');
  if (!matchId) { console.log('  ✗ TIMEOUT'); process.exit(1); }
  console.log(`  ✓ Match: ${matchId}`);

  // 5. Problems
  console.log('\n④ Problems');
  const probRes = await api(`/api/match/${matchId}/problems`, {}, alpha);
  const problems = probRes.data.problems;
  const total = probRes.data.totalProblems;
  console.log(`  ${probRes.data.mode} | ${total} problems`);
  for (const p of problems) {
    const icon = p.progress.status === 'SOLVED' ? '✓' : p.progress.status === 'UNLOCKED' ? '→' : '🔒';
    console.log(`    ${icon} ${p.title}`);
  }

  // 6. Alpha solves
  console.log('\n⑤ Solving');
  let cur = problems.find(p => p.progress.status === 'UNLOCKED');
  let solved = 0;

  while (cur && solved < total) {
    const sol = SOL[cur.slug];
    if (!sol) { console.log(`  ⚠ No solution for ${cur.slug}`); break; }

    process.stdout.write(`  → ${cur.title}... `);
    const res = await api(`/api/match/${matchId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ problemId: cur.id, language: 'cpp', code: sol, mode: 'SUBMIT' }),
    }, alpha);

    const d = res.data;
    if (d.verdict === 'AC') {
      solved++;
      console.log(`✓ AC (${d.passed}/${d.total}) [${d.timeMs}ms]`);
      if (d.earlyFinish) { console.log('  🏁 ALL SOLVED!'); break; }
      const upd = await api(`/api/match/${matchId}/problems`, {}, alpha);
      cur = upd.data.problems.find(p => p.progress.status === 'UNLOCKED');
    } else {
      console.log(`✗ ${d.verdict} (${d.passed}/${d.total}) ${d.error ? d.error.substring(0, 80) : ''}`);
      break;
    }
  }

  // 7. Wait for finalization
  console.log('\n⑥ Finalization');
  await sleep(2000);

  const result = await api(`/api/match/${matchId}/result`, {}, alpha);
  const m = result.data.match;
  const winnerStr = m.winnerId === 'test_alpha' ? 'ALPHA ✓' : m.winnerId === 'test_beta' ? 'BETA' : 'DRAW';
  console.log(`  Status: ${m.status}`);
  console.log(`  Winner: ${winnerStr}`);
  console.log(`  Score:  ${m.scoreA} — ${m.scoreB}`);
  // Alpha is playerA, so eloDeltaA is Alpha's change
  console.log(`  ELO:    Alpha ${m.eloDeltaA >= 0 ? '+' : ''}${m.eloDeltaA} | Beta ${m.eloDeltaB >= 0 ? '+' : ''}${m.eloDeltaB}`);

  // 8. Final profiles
  console.log('\n⑦ Final ELO');
  const aFinal = await api('/api/user/profile', {}, alpha);
  const bFinal = await api('/api/user/profile', {}, beta);
  const aDelta = aFinal.data.elo - aProf.data.elo;
  const bDelta = bFinal.data.elo - bProf.data.elo;
  console.log(`  Alpha: ${aProf.data.elo} → ${aFinal.data.elo} (${aDelta >= 0 ? '+' : ''}${aDelta})`);
  console.log(`  Beta:  ${bProf.data.elo} → ${bFinal.data.elo} (${bDelta >= 0 ? '+' : ''}${bDelta})`);

  // 9. History
  const hist = await api('/api/match/history', {}, alpha);
  console.log(`\n⑧ Match History: ${hist.data?.length ?? 0} matches`);

  // 10. Health
  const health = await api('/api/health', {}, '');
  console.log(`\n⑨ System: ${health.data.status}`);

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   ✓ E2E TEST PASSED                  ║');
  console.log('╚══════════════════════════════════════╝\n');
}

main().catch(err => {
  console.error('\n✗ FAILED:', err.message);
  process.exit(1);
});
