#!/usr/bin/env bash
# Ensure the versioned Hops CLI can run inside a worktree.
# scripts/client-tools is intentionally outside the pnpm workspace, so a root
# pnpm install does not materialize its Bun dependencies.
set -euo pipefail

ROOT="${1:-$(git rev-parse --show-toplevel)}"
TOOLS="$ROOT/scripts/client-tools"

if [ ! -f "$TOOLS/package.json" ] || [ ! -f "$TOOLS/bun.lock" ]; then
  echo "-- client-tools dependency bootstrap skipped (package/lockfile absent)"
  exit 0
fi

if [ -d "$TOOLS/node_modules/@clack/prompts" ] && [ -d "$TOOLS/node_modules/commander" ]; then
  echo "-- client-tools dependencies already present"
  exit 0
fi

command -v bun >/dev/null 2>&1 || {
  echo "ERROR: Bun is required for scripts/client-tools; install it before using this worktree" >&2
  exit 1
}

echo "-- installing scripts/client-tools dependencies"
( cd "$TOOLS" && bun install --frozen-lockfile )
