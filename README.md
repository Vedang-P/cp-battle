# CP Battle

**1v1 competitive programming duels.** Race head-to-head against another programmer — progressive-unlock problems (Easy → Medium → Hard), live timer, see your opponent's progress but never their code. Climb the ELO ladder.

## Features

- **Progressive Unlock** — Solve Easy to unlock Medium, solve Medium to unlock Hard
- **Live Timer** — 20-minute server-authoritative countdown
- **Opponent Awareness** — See test cases passed, wrong submissions, current problem — never their code
- **ELO Matchmaking** — Classic Elo rating system with skill-based pairing
- **3 Languages** — C++ (g++ 12), Python 3.10, Java (OpenJDK 19)
- **Real-time Battle** — Socket.IO-powered opponent progress feed
- **Code Editor** — In-browser Monaco editor with syntax highlighting

## Architecture

```
Next.js (web) ── REST ──> Next.js API routes
   │                          │
   └──── Socket.IO ──> Realtime server (separate process)
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
       PostgreSQL          Redis            Piston
       (Prisma)        (queue + state)     (code judge)
```

### Monorepo (pnpm workspaces)

| Path | Package | Purpose |
|------|---------|---------|
| `apps/web` | `web` | Next.js app (frontend + REST API) + standalone Socket.IO server + matchmaking/finalization workers |
| `packages/db` | `@cp-battle/db` | Prisma schema, client singleton, seeds |
| `packages/elo` | `@cp-battle/elo` | Pure Elo rating math |
| `packages/realtime` | `@cp-battle/realtime` | Shared Socket.IO event contracts |
| `packages/judge` | `@cp-battle/judge` | Piston client, token-based output compare, verdict logic |
| `packages/match` | `@cp-battle/match` | Matchmaking queue, scoring, match lifecycle |

---

## Prerequisites

- **Node.js ≥ 20** and **pnpm ≥ 9** (`npm i -g pnpm`)
- **Docker Desktop** (for Postgres + Redis + Piston)
- **Git**

## Getting Started (Local Development)

```bash
# 1. Clone and install
git clone <repo-url>
cd cp-battle
pnpm install

# 2. Copy env and fill in secrets
cp .env.example .env
# Edit .env — set AUTH_SECRET and NEXTAUTH_SECRET to random strings

# 3. Start infrastructure (postgres, redis, piston)
pnpm infra:up
# Piston's first run installs C++/Python/Java runtimes — give it ~60s

# 4. Apply DB schema + seed problems
pnpm db:generate
pnpm db:push
pnpm db:seed

# 5. Start all services (each in a separate terminal)
pnpm dev                # Next.js on :3000
pnpm dev:realtime       # Socket.IO on :3001
pnpm dev:matchmaker     # Matchmaking worker
pnpm dev:finalizer      # Match finalization worker
```

Open [http://localhost:3000](http://localhost:3000).

Verify infrastructure at [http://localhost:3000/api/health](http://localhost:3000/api/health) — all three services should report `ok`.

---

## Match Rules

| Rule | Value |
|------|-------|
| **Format** | Progressive unlock — Easy → Medium → Hard |
| **Clock** | 20 minutes (server-authoritative) |
| **Scoring** | Easy 100 / Medium 200 / Hard 350 points |
| **Penalty** | -10 points per wrong submission (floor 0) |
| **Winner** | Higher total score; tiebreak on total solve time; else draw |
| **ELO** | K=40 provisional (first 10 games), K=32 established, default 1200 |

## Supported Languages

| Language | Version | Time Multiplier | Memory Multiplier |
|----------|---------|-----------------|-------------------|
| C++ | g++ 12 | 1x | 1x |
| Python | 3.10 | 3x | 2x |
| Java | OpenJDK 19 | 2x | 2x |

---

## Project Structure

```
cp-battle/
├── apps/web/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/                # REST API routes
│   │   │   ├── auth/           # NextAuth + signup
│   │   │   ├── health/         # Health check
│   │   │   ├── leaderboard/    # Top players
│   │   │   ├── match/          # Match operations
│   │   │   └── user/           # User profile
│   │   ├── battle/[matchId]/   # Battle room page
│   │   ├── dashboard/          # User dashboard
│   │   ├── leaderboard/        # Leaderboard page
│   │   ├── play/               # Matchmaking lobby
│   │   ├── signin/             # Sign in
│   │   └── signup/             # Sign up
│   ├── components/             # Shared React components
│   ├── lib/                    # Auth, env, redis, schemas, session
│   └── server/                 # Standalone processes
│       ├── index.ts            # Socket.IO server
│       ├── matchmaker.ts       # Matchmaking worker
│       └── finalizer.ts        # Match finalization worker
├── packages/
│   ├── db/                     # Prisma schema + client
│   ├── elo/                    # Elo rating math
│   ├── judge/                  # Piston code execution
│   ├── match/                  # Match lifecycle + queue
│   └── realtime/               # Socket.IO event types
├── docker-compose.yml          # Postgres + Redis + Piston
└── package.json                # Root monorepo scripts
```

---

## Deployment

### Option 1: Single VPS (Recommended for MVP)

1. **Provision a VPS** (e.g., DigitalOcean, Hetzner) with Docker installed

2. **Clone the repo and set up environment:**
   ```bash
   git clone <repo-url> && cd cp-battle
   cp .env.example .env
   # Edit .env with production values:
   #   APP_URL=https://your-domain.com
   #   AUTH_SECRET=$(openssl rand -base64 32)
   #   NEXTAUTH_SECRET=$(openssl rand -base64 32)
   #   NEXTAUTH_URL=https://your-domain.com
   #   DATABASE_URL=postgresql://cpb:password@localhost:5432/cpbattle
   #   REDIS_URL=redis://localhost:6379
   #   PISTON_URL=http://localhost:2000
   #   REALTIME_CORS_ORIGIN=https://your-domain.com
   ```

3. **Start infrastructure:**
   ```bash
   docker compose up -d
   ```

4. **Install dependencies and build:**
   ```bash
   pnpm install
   pnpm db:generate
   pnpm db:migrate deploy
   pnpm db:seed
   pnpm build
   ```

5. **Start all processes** (use PM2 or systemd for production):
   ```bash
   # Using PM2
   pm2 start "pnpm start" --name web
   pm2 start "pnpm dev:realtime" --name realtime
   pm2 start "pnpm dev:matchmaker" --name matchmaker
   pm2 start "pnpm dev:finalizer" --name finalizer
   pm2 save
   ```

6. **Set up a reverse proxy** (nginx/caddy) for HTTPS:
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
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
       }
   }
   ```

### Option 2: Docker Compose (All-in-One)

For simpler deployments, you can run the app inside Docker too. Add the app services to `docker-compose.yml` and build from a multi-stage Dockerfile.

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `APP_URL` | Yes | — | Base URL of the app |
| `AUTH_SECRET` | Yes | — | NextAuth secret (32+ chars) |
| `NEXTAUTH_SECRET` | Yes | — | NextAuth secret (32+ chars) |
| `NEXTAUTH_URL` | Yes | — | NextAuth base URL |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | — | Redis connection string |
| `PISTON_URL` | No | `http://localhost:2000` | Piston judge URL |
| `JUDGE_CONCURRENCY` | No | `4` | Max concurrent judge jobs |
| `MATCH_DURATION_SECONDS` | No | `1200` | Battle duration (20 min) |
| `WRONG_SUBMISSION_PENALTY` | No | `10` | Points deducted per wrong submission |
| `REALTIME_CORS_ORIGIN` | No | `http://localhost:3000` | CORS origin for Socket.IO |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check (Postgres, Redis, Piston) |
| POST | `/api/auth/signup` | Create account |
| GET/POST | `/api/auth/[...nextauth]` | NextAuth handlers |
| GET | `/api/user/profile` | Current user profile |
| GET | `/api/leaderboard` | Top 100 players by ELO |
| POST | `/api/match/join` | Join matchmaking queue |
| DELETE | `/api/match/join` | Leave matchmaking queue |
| GET | `/api/match/status` | Current queue/match status |
| GET | `/api/match/[matchId]/problems` | Match problems + progress |
| GET | `/api/match/[matchId]/opponent` | Opponent progress (sanitized) |
| POST | `/api/match/[matchId]/submit` | Run or submit code |
| POST | `/api/match/[matchId]/forfeit` | Forfeit match |
| GET | `/api/match/[matchId]/result` | Match result |
| GET | `/api/match/history` | User's match history |

---

## Socket.IO Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `match:join` | Client → Server | `matchId, ack?` |
| `match:leave` | Client → Server | `matchId` |
| `match:forfeit` | Client → Server | `matchId` |
| `submission:verdict` | Server → Client | Verdict payload |
| `opponent:progress` | Server → Client | Sanitized opponent state |
| `problem:unlocked` | Server → Client | `{ difficulty }` |
| `timer:sync` | Server → Client | `{ endsAt, remainingMs }` |
| `match:end` | Server → Client | Final scores + ELO deltas |

---

## Commands Reference

| Command | Description |
|---------|-------------|
| `pnpm dev` | Run Next.js dev server (`:3000`) |
| `pnpm dev:realtime` | Run Socket.IO server (`:3001`) |
| `pnpm dev:matchmaker` | Run matchmaking worker |
| `pnpm dev:finalizer` | Run match finalization worker |
| `pnpm build` | Build Next.js for production |
| `pnpm start` | Start production server |
| `pnpm db:push` | Sync schema to DB (dev) |
| `pnpm db:migrate` | Create + apply a migration |
| `pnpm db:seed` | Seed problems + test cases |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm infra:up` | Start Docker services |
| `pnpm infra:down` | Stop Docker services |
| `pnpm typecheck` | Typecheck all workspaces |
| `pnpm lint` | Lint all workspaces |

---

## License

MIT
