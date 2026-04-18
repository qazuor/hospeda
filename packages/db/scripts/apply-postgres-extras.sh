#!/usr/bin/env bash
# =============================================================================
# apply-postgres-extras.sh
#
# Applies all PostgreSQL features that Drizzle ORM cannot declare natively:
#   - Materialized view: search_index (migrations 0016-0018)
#   - Triggers: set_updated_at, delete_entity_bookmarks (migrations 0019-0020)
#   - CHECK constraints on billing_addon_purchases (migrations 0025-0026)
#   - CHECK constraint on billing_subscription_events.event_type
#
# This script is IDEMPOTENT. Every statement uses IF NOT EXISTS or
# CREATE OR REPLACE, so it is safe to run multiple times.
#
# Usage:
#   # Preferred: run via pnpm wrapper (chained automatically in db:fresh/db:fresh-dev/db:reset)
#   pnpm db:apply-extras
#
#   # Direct: reads DATABASE_URL from env or auto-loads apps/api/.env.local
#   packages/db/scripts/apply-postgres-extras.sh
#
#   # Direct with explicit URL as first argument
#   packages/db/scripts/apply-postgres-extras.sh "postgresql://user:pass@host:5432/db"
#
# Run this after any of:
#   - pnpm db:fresh-dev   (drizzle-kit push)
#   - pnpm db:fresh       (reset + migrate + seed)
#   - pnpm db:migrate     (on a fresh environment)
#   - Any drizzle-kit push in development
#
# Reference: packages/db/docs/triggers-manifest.md
#            docs/decisions/ADR-017-postgres-specific-features.md
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Resolve DATABASE_URL
# ---------------------------------------------------------------------------
# Order of precedence:
#   1. First CLI argument
#   2. DATABASE_URL or HOSPEDA_DATABASE_URL from current shell
#   3. HOSPEDA_DATABASE_URL from apps/api/.env.local (canonical per SPEC-035)
# ---------------------------------------------------------------------------
DB_URL="${1:-${DATABASE_URL:-${HOSPEDA_DATABASE_URL:-}}}"

if [[ -z "${DB_URL}" ]]; then
  SCRIPT_DIR_EARLY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  ENV_FILE="${SCRIPT_DIR_EARLY}/../../../apps/api/.env.local"
  if [[ -f "${ENV_FILE}" ]]; then
    DB_URL="$(grep -E '^HOSPEDA_DATABASE_URL=' "${ENV_FILE}" | head -1 | cut -d '=' -f 2- | sed -E 's/^["'\'']?//; s/["'\'']?$//')"
  fi
fi

if [[ -z "${DB_URL}" ]]; then
  echo "ERROR: No database URL provided." >&2
  echo "  Set HOSPEDA_DATABASE_URL or DATABASE_URL in your environment," >&2
  echo "  define it in apps/api/.env.local," >&2
  echo "  or pass the URL as the first argument to this script." >&2
  exit 1
fi

# Locate the project root relative to this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="${SCRIPT_DIR}/../src/migrations"
MANUAL_DIR="${MIGRATIONS_DIR}/manual"

# Verify required directories exist
if [[ ! -d "${MANUAL_DIR}" ]]; then
  echo "ERROR: Manual migrations directory not found: ${MANUAL_DIR}" >&2
  exit 1
fi

if [[ ! -d "${MIGRATIONS_DIR}" ]]; then
  echo "ERROR: Migrations directory not found: ${MIGRATIONS_DIR}" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Helper: run SQL and report result
# ---------------------------------------------------------------------------
run_sql() {
  local label="$1"
  local sql="$2"
  echo "  Applying: ${label} ..."
  psql "${DB_URL}" --single-transaction --quiet --no-psqlrc \
    --variable ON_ERROR_STOP=1 \
    --command "${sql}" 2>&1 | sed 's/^/    /'
  echo "  Done: ${label}"
}

# ---------------------------------------------------------------------------
# Helper: run a SQL file and report result
# ---------------------------------------------------------------------------
run_file() {
  local label="$1"
  local file="$2"
  if [[ ! -f "${file}" ]]; then
    echo "ERROR: Migration file not found: ${file}" >&2
    exit 1
  fi
  echo "  Applying: ${label} ..."
  psql "${DB_URL}" --single-transaction --quiet --no-psqlrc \
    --variable ON_ERROR_STOP=1 \
    --file "${file}" 2>&1 | sed 's/^/    /'
  echo "  Done: ${label}"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
echo ""
echo "============================================================"
echo " apply-postgres-extras.sh"
echo " Target: ${DB_URL%%@*}@..."
echo "============================================================"
echo ""

# ---------------------------------------------------------------------------
# Apply all manual migrations in lexical order
# ---------------------------------------------------------------------------
# Each SQL file under manual/ is expected to be idempotent (IF NOT EXISTS,
# CREATE OR REPLACE, DO blocks with existence checks). Files matching
# *_down.sql are skipped automatically — those are reversal migrations,
# applied only via ad-hoc rollback procedures.
# ---------------------------------------------------------------------------

mapfile -t SQL_FILES < <(find "${MANUAL_DIR}" -maxdepth 1 -type f -name '*.sql' | sort)

TOTAL=0
for f in "${SQL_FILES[@]}"; do
  base="$(basename "${f}")"
  [[ "${base}" == *_down.sql ]] && continue
  TOTAL=$((TOTAL + 1))
done

if (( TOTAL == 0 )); then
  echo "WARNING: No manual migration files found in ${MANUAL_DIR}"
  echo ""
else
  IDX=0
  for f in "${SQL_FILES[@]}"; do
    base="$(basename "${f}")"
    if [[ "${base}" == *_down.sql ]]; then
      echo "  Skipping (down migration): ${base}"
      continue
    fi
    IDX=$((IDX + 1))
    echo "[${IDX}/${TOTAL}] Applying: ${base}"
    run_file "${base}" "${f}"
    echo ""
  done
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo "============================================================"
echo " All PostgreSQL extras applied successfully."
echo ""
echo " Tip: to verify, run the queries in:"
echo "   packages/db/docs/triggers-manifest.md (section 5)"
echo "============================================================"
echo ""
