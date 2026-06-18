FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9.7.1 --activate

# --- Dependencies (cached unless lockfile changes) ---
FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/elo/package.json ./packages/elo/
COPY packages/judge/package.json ./packages/judge/
COPY packages/match/package.json ./packages/match/
COPY packages/realtime/package.json ./packages/realtime/
RUN pnpm install --frozen-lockfile

# --- Build ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/elo/node_modules ./packages/elo/node_modules
COPY --from=deps /app/packages/judge/node_modules ./packages/judge/node_modules
COPY --from=deps /app/packages/match/node_modules ./packages/match/node_modules
COPY --from=deps /app/packages/realtime/node_modules ./packages/realtime/node_modules
COPY . .
RUN pnpm db:generate

# Provide placeholder secrets so next build can evaluate route modules
# that read env vars at module scope. Real values come from docker-compose at runtime.
ENV AUTH_SECRET=build-placeholder
ENV NEXTAUTH_SECRET=build-placeholder
RUN pnpm build

# --- Production runner ---
# Single image serves all containers (web, realtime, workers).
# Workers override the command in docker-compose.web.yml.
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@9.7.1 --activate

# Copy built app + all deps + source (workers need TS source for tsx).
COPY --from=builder /app ./

EXPOSE 3000 3002

# Default: Next.js standalone production server.
CMD ["node", "apps/web/.next/standalone/apps/web/server.js"]
