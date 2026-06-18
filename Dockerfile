FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9.7.1 --activate

# --- Dependencies ---
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
RUN pnpm build

# --- Production ---
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@9.7.1 --activate

# Copy the standalone Next.js output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
# Copy Prisma schema + migrations for deploy
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# Copy tsx for running the standalone worker processes
COPY --from=builder /app/node_modules/.pnpm/tsx@4.9.3/node_modules/tsx ./node_modules/tsx
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/packages ./packages

EXPOSE 3000 3002

# Start all processes via PM2 (installed in ecosystem.config.js)
CMD ["node", "apps/web/server.js"]
