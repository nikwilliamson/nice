#!/usr/bin/env bash
# Screenshots of every Nice page in a real browser: scripts/shots.sh [label]
# ONLY=<regex> limits it to matching pages (tab-home, room-kitchen, library-viz, …).
# LOCAL=1 draws with the local build/ instead of the deployed cards; add NIGHT=1 to see night.
set -euo pipefail
cd "$(dirname "$0")/.."
exec docker run --rm -u "$(id -u):$(id -g)" --network host --ipc host \
  -v "$PWD:/w" -w /w -e HOME=/tmp -e ONLY="${ONLY:-}" -e LOCAL="${LOCAL:-}" -e NIGHT="${NIGHT:-}" --env-file .env \
  mcr.microsoft.com/playwright:v1.48.2-jammy node scripts/shots.mjs "$@"
