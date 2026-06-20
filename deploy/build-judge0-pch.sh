#!/usr/bin/env bash
# Build the <bits/stdc++.h> precompiled header used by the Judge0 C++ compiler.
#
# Run this ON the Judge0 VM ONCE before `docker compose ... up`, and again
# whenever the Judge0 image (and thus its GCC) changes. The compose file
# bind-mounts the resulting .gch into every Judge0 container, which cuts each
# `-O2` C++ compile from ~1.6s to ~0.4s — the dominant cost when many users
# submit at once. GCC silently ignores the PCH if compile flags ever differ, so
# it is always safe.
#
# IMPORTANT: if this file is missing when the stack starts, Docker will create an
# empty DIRECTORY at the mount source and compilation will misbehave. Always run
# this before bringing the Judge0 stack up on a fresh VM.
set -euo pipefail

IMAGE="${JUDGE0_IMAGE:-mrkushalsm/judge0:latest}"
HDR=/usr/local/gcc-9.2.0/include/c++/9.2.0/x86_64-pc-linux-gnu/bits/stdc++.h
OUT_DIR=/opt/judge0-pch

sudo mkdir -p "$OUT_DIR"
echo "Building PCH from $IMAGE (this takes a few seconds)..."
sudo docker run --rm --entrypoint bash "$IMAGE" -c \
  "/usr/local/gcc-9.2.0/bin/g++ -O2 -std=c++17 -x c++-header $HDR -o /tmp/o.gch && cat /tmp/o.gch" \
  | sudo tee "$OUT_DIR/stdc++.h.gch" >/dev/null
sudo chmod 644 "$OUT_DIR/stdc++.h.gch"
echo "Done: $(ls -la "$OUT_DIR/stdc++.h.gch")"
