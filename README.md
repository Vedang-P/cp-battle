# Zapdos

**1v1 competitive programming duels.** Race head-to-head against another programmer — progressive-unlock problems (Easy → Medium), live timer, see your opponent's progress but never their code. Climb the ELO ladder.

## Features

- **Progressive Unlock** — Solve Easy to unlock Medium
- **Live Timer** — 20-minute server-authoritative countdown
- **Opponent Awareness** — See test cases passed, wrong submissions, current problem — never their code
- **ELO Matchmaking** — Classic Elo rating system with skill-based pairing
- **3 Languages** — C++, Python, Java (Judge0 sandbox)
- **Real-time Battle** — Socket.IO-powered opponent progress feed (Redis adapter for horizontal scaling)
- **Code Editor** — In-browser Monaco editor with syntax highlighting
- **400+ Real Problems** — Sourced from CSES problem archive
- **ELO Rank Tiers** — Bronze → Silver → Gold → Platinum → Diamond → Master → Grandmaster
- **Win Streaks** — Track your hot streaks with visual indicators
- **Interactive Terminal Landing** — Type commands, explore the platform
- **Music Player** — Playlist with loop-all, mute toggle, persisted preferences
- **Practice Mode** — Play against AI bot with adjustable difficulty

## Architecture

```
Browser ──HTTPS/WSS──> Nginx ──► Next.js (:3000)
                                └─REST──> PostgreSQL
                                └─REST──> Redis (queue, limits, adapter)
                                └─enqueue──> judge-worker ──► Judge0 (:2358)
                                └─Redis pub/sub──> Socket.IO (any instance)

Next.js (:3000) ──REST──> Judge0 (:2358) ──> isolate sandbox

Workers (separate processes):
  - realtime   (Socket.IO server on :3002, Redis adapter)
  - matchmaker (Redis SET NX locked, recursive setTimeout)
  - finalizer  (SELECT FOR UPDATE, idempotent, emits match:end)
  - bot        (practice AI, recursive setTimeout, graceful shutdown)
```

### Monorepo (pnpm workspaces)

| Path | Package | Purpose |
|------|---------|---------|
| `apps/web` | `web` | Next.js app (frontend + REST API) + standalone Socket.IO server + workers |
| `packages/db` | `@zapdos/db` | Prisma schema, client singleton, seeds |
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
git clone <repo-url>
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
pnpm db:seed

# 5. (Optional) Scrape 400+ real problems from CSES
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
| **Format** | Progressive unlock — Easy → Medium (HARD reserved) |
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

Zapdos uses **real problems** sourced from competitive programming platforms — not generated.

| Source | Count | How to add |
|--------|-------|------------|
| Hand-authored seed | 9 | `pnpm db:seed` |
| CSES Problem Set | 394 | `pnpm scrape-problems -- --cses` |
| **Total** | **403+** | |

### Scraping more problems

```bash
pnpm scrape-problems -- --cses      # CSES (400 problems)
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

## Deployment

### Option 1: Single EC2 + Judge0 on separate EC2 (Recommended)

1. **Provision two EC2 instances** in the same VPC:
   - Web instance (t3.large, 8GB): runs Next.js + all workers via PM2
   - Judge0 instance (t3.medium, 4GB): runs Judge0 CE in Docker

2. **Set up managed services:**
   - RDS Postgres 16 (or Neon/Supabase free tier)
   - ElastiCache Redis (or Upstash free tier)

3. **On the web instance:**
   ```bash
   git clone <repo-url> && cd zapdos
   cp .env.example .env
   # Edit .env with production values (DATABASE_URL, REDIS_URL, JUDGE0_URL, secrets)
   pnpm install
   pnpm db:generate
   pnpm db:migrate:deploy
   pnpm db:seed
   pnpm scrape-problems -- --cses
   pnpm build

   # Start all processes with PM2
   pm2 start ecosystem.config.cjs --env production
   pm2 save
   pm2 startup
   ```

4. **Set up Nginx** for HTTPS + WebSocket upgrade:
   ```nginx
   server {
       listen 443 ssl;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }

       location /socket.io/ {
           proxy_pass http://localhost:3002;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
       }
   }
   ```

5. **On the Judge0 instance:**
   ```bash
   # Install Docker, then:
   docker compose up -d judge0-server judge0-worker judge0-db judge0-redis
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

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check (Postgres, Redis, Judge0) |
| POST | `/api/auth/signup` | Create account |
| GET/POST | `/api/auth/[...nextauth]` | NextAuth handlers |
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
| `pnpm db:seed` | Seed initial 9 problems |
| `pnpm scrape-problems` | Scrape real problems from CSES/AtCoder |
| `pnpm infra:up` | Start Docker services |
| `pnpm infra:down` | Stop Docker services |
| `pnpm typecheck` | Typecheck all workspaces |
| `pnpm lint` | Lint all workspaces |

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

---

## License

MIT
