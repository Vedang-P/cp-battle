# Zapdos

**1v1 competitive programming duels.** Race head-to-head against another programmer — progressive-unlock problems (Easy → Medium), live timer, see your opponent's progress but never their code. Climb the ELO ladder.

```
██████████                         █████
░█░░░░░░███                         ░░███
░     ███░    ██████   ████████   ███████   ██████   █████
     ███     ░░░░░███ ░░███░░███ ███░░███  ███░░███ ███░░
    ███       ███████  ░███ ░███░███ ░███ ░███ ░███░░█████
  ████     █ ███░░███  ░███ ░███░███ ░███ ░███ ░███ ░░░░███
 ███████████░░████████ ░███████ ░░████████░░██████  ██████
░░░░░░░░░░░  ░░░░░░░░  ░███░░░   ░░░░░░░░  ░░░░░░  ░░░░░░
                       ░███
                       █████
                      ░░░░░
```

## Features

- **Progressive Unlock** — Solve Easy problems to unlock Medium
- **Live Timer** — 20-minute server-authoritative countdown
- **Opponent Awareness** — See test cases passed, wrong submissions, current problem — never their code
- **ELO Matchmaking** — Classic Elo rating system with skill-based pairing
- **3 Languages** — C++, Python, Java via Judge0 sandbox
- **Real-time Battle** — Socket.IO-powered opponent progress feed with Redis adapter for horizontal scaling
- **Code Editor** — In-browser Monaco editor with syntax highlighting
- **400+ Real Problems** — Sourced from CSES Problem Set
- **ELO Rank Tiers** — Bronze → Silver → Gold → Platinum → Diamond → Master → Grandmaster
- **Win Streaks** — Track hot streaks with visual indicators
- **Practice Mode** — Play against AI bot with Easy/Medium difficulty
- **Google OAuth** — Sign in with Google or email/password
- **Anonymous Feedback** — Built-in feedback system
- **Interactive Terminal Landing** — Type commands, explore the platform
- **Music Player** — Playlist with loop-all, mute toggle, persisted preferences

## Architecture

```
Browser ──HTTPS/WSS──> Nginx ──► Next.js (:3000)
                                └─REST──> PostgreSQL
                                └─REST──> Redis (queue, limits, adapter)
                                └─enqueue──> matchmaker ──► createMatch
                                └─Redis pub/sub──> Socket.IO (any instance)

Next.js (:3000) ──REST──> Judge0 (:2358) ──> isolate sandbox

Workers (separate processes):
  - realtime   (Socket.IO server on :3002, Redis adapter)
  - matchmaker (Redis sorted set, HMAC-signed emit bridge)
  - finalizer  (SELECT FOR UPDATE, idempotent, emits match:end)
  - bot        (practice AI, recursive setTimeout, graceful shutdown)
```

### Monorepo (pnpm workspaces)

| Path | Package | Purpose |
|------|---------|---------|
| `apps/web` | `web` | Next.js app (frontend + REST API) + Socket.IO server + workers |
| `packages/db` | `@zapdos/db` | Prisma schema, client singleton, migrations |
| `packages/elo` | `@zapdos/elo` | Pure Elo rating math |
| `packages/realtime` | `@zapdos/realtime` | Shared Socket.IO event contracts |
| `packages/judge` | `@zapdos/judge` | Judge0 client, token-based output compare, verdict logic |
| `packages/match` | `@zapdos/match` | Matchmaking queue, scoring, match lifecycle |

---

## Prerequisites

- **Node.js ≥ 20** and **pnpm ≥ 9** (`npm i -g pnpm`)
- **Docker Desktop** (for Postgres + Redis + Judge0)
- **Git**

## Getting Started (Local Development)

```bash
# 1. Clone and install
git clone https://github.com/Vedang-P/cp-battle.git
cd zapdos
pnpm install

# 2. Copy env and fill in secrets
cp .env.example .env
# Edit .env — set AUTH_SECRET and NEXTAUTH_SECRET to random strings

# 3. Start infrastructure (postgres, redis, Judge0)
pnpm infra:up
# Judge0's first run may take ~30s to be ready

# 4. Apply DB schema + seed problems
pnpm db:generate
pnpm db:push

# 5. Scrape 400+ real problems from CSES
pnpm scrape-problems -- --cses

# 6. Start all services (each in a separate terminal, or use start-dev.sh)
pnpm dev                # Next.js on :3000
pnpm dev:realtime       # Socket.IO on :3002
pnpm dev:matchmaker     # Matchmaking worker
pnpm dev:finalizer      # Match finalization worker
pnpm dev:bot            # Practice bot worker
```

Or start all at once:
```bash
bash scripts/start-dev.sh
```

Open [http://localhost:3000](http://localhost:3000).

Verify infrastructure at [http://localhost:3000/api/health](http://localhost:3000/api/health) — all three services should report `ok`.

---

## Match Rules

| Rule | Value |
|------|-------|
| **Format** | Progressive unlock — Easy → Medium |
| **Clock** | 20 minutes (server-authoritative) |
| **Scoring** | Easy 100 / Medium 200 points |
| **Penalty** | -10 points per wrong submission (floor 0) |
| **Winner** | Higher total score; tiebreak on total solve time; else draw |
| **ELO** | K=40 provisional (first 10 games), K=32 established, default 1200 |

## Supported Languages

| Language | Judge0 ID | Time Multiplier | Memory Multiplier |
|----------|-----------|-----------------|-------------------|
| C++ | 54 (GCC 9.2.0) | 1x | 1x |
| Python | 71 (3.8.1) | 3x | 2x |
| Java | 62 (OpenJDK 13.0.1) | 2x | 2x |

---

## Problem Corpus

Zapdos uses **real problems** sourced from the CSES Problem Set — not generated.

| Source | Count | How to add |
|--------|-------|------------|
| CSES Problem Set | 394 | `pnpm scrape-problems -- --cses` |
| **Total** | **394+** | |

### Scraping problems

```bash
pnpm scrape-problems -- --cses      # CSES (394 problems)
pnpm scrape-problems -- --atcoder   # AtCoder ABC (1000+ problems)
pnpm scrape-problems                # all sources
```

The scraper:
- Fetches real problem statements + sample test cases
- Saves to DB in batches of 10 (progress is never lost)
- Live progress output with timestamps
- Upserts by slug (re-running updates existing problems)
- Biases toward EASY/MEDIUM problems

### Adding your own music

Drop MP3 files into `apps/web/public/audio/music/` and update `apps/web/public/audio/manifest.json`:

```json
{
  "tracks": [
    { "file": "my-track-1.mp3", "title": "My Track 1" },
    { "file": "my-track-2.mp3", "title": "My Track 2" }
  ]
}
```

The music player loops through all tracks and back to the start. Users can mute/unmute from the navbar.

---

## Production Deployment

### Current Setup: Two GCP VMs

| VM | Machine Type | IP | Purpose |
|----|-------------|-----|---------|
| `cpb-web` | e2-medium | 35.232.246.89 (static) | Next.js + all workers + Postgres + Redis + Nginx |
| `cpb-judge0` | e2-standard-2 | 10.128.0.3 (internal) | Judge0 CE (3 workers, privileged mode) |

### Architecture

All app services run in Docker containers on the web VM:

```
┌─ cpb-web (e2-medium, 2 vCPU, 4GB) ─────────────────────┐
│                                                          │
│  Nginx (:80) ──► Next.js (:3000)                        │
│              ──► Socket.IO (:3002)                       │
│                                                          │
│  ┌─ Docker Compose Stack ──────────────────────────────┐ │
│  │ postgres  redis  web  realtime  matchmaker  ...     │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  Judge0 runs on a separate VM (needs privileged mode)    │
└──────────────────────────────────────────────────────────┘

┌─ cpb-judge0 (e2-standard-2, 2 vCPU, 8GB) ──────────────┐
│  judge0-server (:2358)                                   │
│  judge0-worker ×3                                        │
│  judge0-db (Postgres)                                    │
│  judge0-redis                                            │
└──────────────────────────────────────────────────────────┘
```

### Deploying Changes

```bash
# From local machine
git push origin master

# SSH into web VM
gcloud compute ssh cpb-web --zone=us-central1-a

# Pull changes, rebuild, restart
cd /home/vedang/cp-battle
git pull
sudo docker build -t zapdos-web:latest .
sudo docker compose --env-file .env.production -f deploy/docker-compose.web.yml up -d
```

### Database Migrations

```bash
# On the web VM
cd /home/vedang/cp-battle
sudo docker compose --env-file .env.production -f deploy/docker-compose.web.yml \
  exec -T web npx prisma migrate deploy
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `APP_URL` | Yes | — | Base URL of the app |
| `AUTH_SECRET` | Yes | — | NextAuth secret (32+ chars) |
| `NEXTAUTH_SECRET` | Yes | — | NextAuth secret (32+ chars) |
| `NEXTAUTH_URL` | Yes | — | NextAuth base URL |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | — | Redis connection string |
| `JUDGE0_URL` | No | `http://localhost:2358` | Judge0 judge URL |
| `JUDGE0_API_KEY` | No | — | RapidAPI key (production) |
| `JUDGE_CONCURRENCY` | No | `4` | Max concurrent judge jobs |
| `MATCH_DURATION_SECONDS` | No | `1200` | Battle duration (20 min) |
| `WRONG_SUBMISSION_PENALTY` | No | `10` | Points deducted per wrong submission |
| `REALTIME_CORS_ORIGIN` | No | `http://localhost:3000` | CORS origin for Socket.IO |
| `REALTIME_URL` | No | `http://localhost:3002` | Internal URL for /emit bridge |
| `NEXT_PUBLIC_REALTIME_URL` | No | `http://localhost:3002` | Public URL for browser Socket.IO |
| `GOOGLE_CLIENT_ID` | No | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | — | Google OAuth client secret |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check (Postgres, Redis, Judge0) |
| POST | `/api/auth/signup` | Create account |
| GET/POST | `/api/auth/[...nextauth]` | NextAuth handlers (credentials + Google OAuth) |
| GET | `/api/auth/socket-token` | Get JWT for Socket.IO auth |
| GET | `/api/user/profile` | Current user profile |
| GET | `/api/leaderboard` | Top 100 players by ELO |
| POST | `/api/match/join` | Join matchmaking queue |
| DELETE | `/api/match/join` | Leave matchmaking queue |
| GET | `/api/match/status` | Current queue/match status |
| POST | `/api/match/practice` | Start practice match vs bot |
| GET | `/api/match/[matchId]/problems` | Match problems + progress |
| GET | `/api/match/[matchId]/opponent` | Opponent progress (sanitized) |
| POST | `/api/match/[matchId]/submit` | Run or submit code |
| POST | `/api/match/[matchId]/forfeit` | Forfeit match |
| GET | `/api/match/[matchId]/result` | Match result |
| GET | `/api/match/history` | User's match history |
| POST | `/api/feedback` | Submit anonymous feedback |
| GET | `/api/feedback` | Read feedback (admin in future) |

---

## Commands Reference

| Command | Description |
|---------|-------------|
| `pnpm dev` | Run Next.js dev server (`:3000`) |
| `pnpm dev:realtime` | Run Socket.IO server (`:3002`) |
| `pnpm dev:matchmaker` | Run matchmaking worker |
| `pnpm dev:finalizer` | Run match finalization worker |
| `pnpm dev:bot` | Run practice bot worker |
| `pnpm build` | Build Next.js for production |
| `pnpm start` | Start production server |
| `pnpm db:push` | Sync schema to DB (dev) |
| `pnpm db:migrate:deploy` | Apply migrations (production) |
| `pnpm db:seed` | Seed initial problems (now a no-op, use scraper) |
| `pnpm scrape-problems` | Scrape real problems from CSES/AtCoder |
| `pnpm infra:up` | Start Docker services |
| `pnpm infra:down` | Stop Docker services |
| `pnpm typecheck` | Typecheck all workspaces |
| `pnpm lint` | Lint all workspaces |

---

## Testing

### E2E Match Test

```bash
# Requires running dev server + seeded DB with test users
BASE_URL=http://localhost:3000 pnpm tsx scripts/e2e-match.js
```

### Stress Test

```bash
# Run with default 100 virtual users
BASE_URL=http://localhost:3000 pnpm tsx scripts/stress-test.ts

# Custom user count
USERS=50 DURATION=60 pnpm tsx scripts/stress-test.ts
```

---

## Security

- **HMAC-signed /emit bridge** — all internal Socket.IO event emissions are signed with AUTH_SECRET
- **JWT-expiry verification** — Socket.IO tokens expire after 1 hour
- **CSRF protection** — Origin/Referer check on all mutating API routes
- **Row-level locking** — `SELECT FOR UPDATE` on Match and User rows during finalization
- **Atomic rate limiting** — Lua scripts for INCR+PEXPIRE (no orphaned keys)
- **Sanitized opponent data** — compile/runtime errors never sent to the opponent
- **Judge0 sandbox** — `enable_network: false`, per-process time/memory limits
- **bcrypt password hashing** — cost factor 12
- **Disposable email blocklist** — 200+ domains blocked at signup
- **Input validation** — Zod schemas on all API inputs

---

## License

MIT
