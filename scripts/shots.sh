#!/usr/bin/env bash
# Screenshots of every Nice page in a real browser: scripts/shots.sh [label]
# ONLY=<regex> limits it to matching pages (tab-home, room-kitchen, library-viz, …).
set -euo pipefail
cd "$(dirname "$0")/.."
exec docker run --rm -u "$(id -u):$(id -g)" --network host --ipc host \
  -v "$PWD:/w" -w /w -e HOME=/tmp -e ONLY="${ONLY:-}" --env-file .env \
  mcr.microsoft.com/playwright:v1.48.2-jammy node scripts/shots.mjs "$@"
