#!/bin/bash
# Start all CP Battle dev servers as detached background processes
export PATH="$HOME/.npm-global/bin:$PATH"
cd /Users/vedang/Desktop/cp-battle

# Start each process in its own bash subshell to detach from parent
bash -c 'cd /Users/vedang/Desktop/cp-battle && export PATH="$HOME/.npm-global/bin:$PATH" && exec pnpm dev > /tmp/cpb-web.log 2>&1' &
bash -c 'cd /Users/vedang/Desktop/cp-battle && export PATH="$HOME/.npm-global/bin:$PATH" && exec pnpm dev:realtime > /tmp/cpb-realtime.log 2>&1' &
bash -c 'cd /Users/vedang/Desktop/cp-battle && export PATH="$HOME/.npm-global/bin:$PATH" && exec pnpm dev:matchmaker > /tmp/cpb-matchmaker.log 2>&1' &
bash -c 'cd /Users/vedang/Desktop/cp-battle && export PATH="$HOME/.npm-global/bin:$PATH" && exec pnpm dev:finalizer > /tmp/cpb-finalizer.log 2>&1' &

echo "All servers launched."
