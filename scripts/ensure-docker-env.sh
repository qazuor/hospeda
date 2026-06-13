#!/usr/bin/env bash
#
# ensure-docker-env.sh
#
# Guarantees that `docker/.env` exists before any `docker compose
# --env-file docker/.env ...` command runs (db:start / db:stop / db:fresh /
# db:fresh-dev). Without it, those scripts abort with
# `couldn't find env file: .../docker/.env` on a fresh checkout or in a new
# git worktree (the file is gitignored and never committed, and `.env.example`
# is the only template that ships).
#
# `docker-compose.yml` already provides sane defaults for every variable via
# `${VAR:-default}`, so this simply seeds the `--env-file` target from the
# committed `docker/.env.example` template. Idempotent: does nothing when
# `docker/.env` already exists, so operator-edited values are never clobbered.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/docker/.env"
EXAMPLE="$ROOT/docker/.env.example"

if [ -f "$ENV_FILE" ]; then
    exit 0
fi

if [ ! -f "$EXAMPLE" ]; then
    echo "ensure-docker-env: docker/.env.example not found — cannot seed docker/.env" >&2
    exit 1
fi

cp "$EXAMPLE" "$ENV_FILE"
echo "ensure-docker-env: created docker/.env from docker/.env.example (compose defaults)"
