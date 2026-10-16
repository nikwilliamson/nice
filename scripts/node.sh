#!/usr/bin/env bash
# Run node in a container with the repo mounted. The Pi has no node of its own.
# Host networking so scripts can reach Home Assistant on localhost:8123.
set -euo pipefail
cd "$(dirname "$0")/.."
exec docker run --rm -i -u "$(id -u):$(id -g)" --network host \
  -v "$PWD:/w" -w /w -e npm_config_cache=/w/.npm --env-file <(cat .env 2>/dev/null || true) \
  node:22-alpine node "$@"
