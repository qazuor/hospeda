#!/usr/bin/env bash
# =============================================================================
# apply-postgres-extras.sh
#
# Thin wrapper around apply-postgres-extras.mjs. The Node-based variant uses
# the `pg` driver directly and does NOT require `psql` to be installed on the
# host — this matters for the VPS (where the toolkit runs from the Docker
# host, not from inside the postgres container) and for CI runners.
#
# The legacy interface is preserved: an optional first argument is the
# DATABASE URL, otherwise the script falls back to HOSPEDA_DATABASE_URL /
# DATABASE_URL from the environment, then HOSPEDA_DATABASE_URL from
# apps/api/.env.local (resolved inside the .mjs).
#
# All real logic lives in apply-postgres-extras.mjs. This file exists to keep
# existing call-sites (integration test setups, docs, muscle memory) working
# without changes after the psql dependency was removed.
#
# Usage:
#   pnpm db:apply-extras
#   packages/db/scripts/apply-postgres-extras.sh
#   packages/db/scripts/apply-postgres-extras.sh "postgresql://user:pass@host:5432/db"
#
# Reference: packages/db/docs/triggers-manifest.md
#            docs/decisions/ADR-017-postgres-specific-features.md
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "${SCRIPT_DIR}/apply-postgres-extras.mjs" "$@"
