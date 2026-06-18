#!/bin/bash
# Start all Zapdos dev servers as detached background processes.
# Usage: ./scripts/start-dev.sh
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
export PATH="$HOME/.npm-global/bin:$PATH"
cd "$ROOT_DIR"

# Start each process in its own bash subshell to detach from parent
bash -c "cd '$ROOT_DIR' && export PATH='$HOME/.npm-global/bin:$PATH' && exec pnpm dev > /tmp/zapdos-web.log 2>&1" &
bash -c "cd '$ROOT_DIR' && export PATH='$HOME/.npm-global/bin:$PATH' && exec pnpm dev:realtime > /tmp/zapdos-realtime.log 2>&1" &
bash -c "cd '$ROOT_DIR' && export PATH='$HOME/.npm-global/bin:$PATH' && exec pnpm dev:matchmaker > /tmp/zapdos-matchmaker.log 2>&1" &
bash -c "cd '$ROOT_DIR' && export PATH='$HOME/.npm-global/bin:$PATH' && exec pnpm dev:finalizer > /tmp/zapdos-finalizer.log 2>&1" &
bash -c "cd '$ROOT_DIR' && export PATH='$HOME/.npm-global/bin:$PATH' && exec pnpm dev:bot > /tmp/zapdos-bot.log 2>&1" &

echo "All 5 servers launched. Logs in /tmp/zapdos-*.log"
