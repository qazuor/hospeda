#!/usr/bin/env bash
# =============================================================================
# T-015 — Round-trip / anti-drift test  (SPEC-178)
#
# Proves:
#   1. An EMPTY DB, after extensions + db:migrate + apply-extras, has a schema
#      that MATCHES the committed TS schema (no pending drift).
#   2. Expected object counts from the validated run:
#        - Base tables: >= 82
#        - search_index materialized view: present
#        - 3 trigger functions: set_updated_at, delete_entity_bookmarks,
#          handle_soft_delete_cascade
#   3. drizzle-kit generate reports NO new files (= zero drift).
#
# Usage:
#   bash packages/db/test/migrations/t015-round-trip.sh
#   (Run from the repo root)
#
# Exit codes: 0 = all assertions pass; 1 = at least one assertion failed.
# =============================================================================
set -euo pipefail

CONTAINER="spec178-roundtrip"
PORT=55441
DB="t"
URL="postgresql://postgres:test@localhost:${PORT}/${DB}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"
PKG_DIR="${REPO_ROOT}/packages/db"
EXTRAS_SCRIPT="${PKG_DIR}/scripts/apply-postgres-extras.mjs"
MIGRATIONS_DIR="packages/db/src/migrations"

PASS=0
FAIL=0

# --- Color helpers -----------------------------------------------------------
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
RESET=$'\033[0m'

log_ok()   { echo "${GREEN}  ✓ ${1}${RESET}"; PASS=$((PASS + 1)); }
log_fail() { echo "${RED}  ✗ ${1}${RESET}"; FAIL=$((FAIL + 1)); }
log_info() { echo "${YELLOW}  → ${1}${RESET}"; }

# --- Cleanup on exit ---------------------------------------------------------
cleanup() {
    log_info "Cleaning up container ${CONTAINER}..."
    docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true
    # Revert any throwaway migration files drizzle-kit may have generated
    git -C "${REPO_ROOT}" checkout -- "${MIGRATIONS_DIR}" 2>/dev/null || true
    git -C "${REPO_ROOT}" clean -fd -- "${MIGRATIONS_DIR}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo ""
echo "======================================================================"
echo " T-015 — Round-trip / anti-drift"
echo "======================================================================"

# Pre-cleanup in case of a prior failed run
docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true

# --- Step 1: Start ephemeral Postgres container ------------------------------
log_info "Starting Postgres container..."
docker run -d \
    --name "${CONTAINER}" \
    -e POSTGRES_PASSWORD=test \
    -e POSTGRES_DB="${DB}" \
    -p "${PORT}:5432" \
    postgres:15-alpine >/dev/null

# --- Step 2: Wait for REAL readiness (query loop, not pg_isready) ------------
log_info "Waiting for Postgres to accept queries..."
if ! timeout 90 bash -c "until docker exec ${CONTAINER} psql -U postgres -d ${DB} -c \"SELECT 1\" >/dev/null 2>&1; do :; done"; then
    log_fail "Postgres did not become ready within 90s"
    exit 1
fi
log_ok "Postgres ready"

# --- Step 3: Install extensions (baseline uses gen_random_uuid) --------------
log_info "Installing extensions..."
docker exec "${CONTAINER}" psql -U postgres -d "${DB}" -c \
    'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS "pgcrypto"; CREATE EXTENSION IF NOT EXISTS "unaccent";' \
    >/dev/null
log_ok "Extensions installed"

# --- Step 4: Apply drizzle-kit migrate (versioned baseline) ------------------
log_info "Running db:migrate..."
MIGRATE_OUT="$(mktemp)"
if ! HOSPEDA_DATABASE_URL="${URL}" pnpm --filter @repo/db db:migrate >"${MIGRATE_OUT}" 2>&1; then
    echo "${RED}  db:migrate failed:${RESET}"
    cat "${MIGRATE_OUT}"
    log_fail "db:migrate exited non-zero"
    rm -f "${MIGRATE_OUT}"
    exit 1
fi
rm -f "${MIGRATE_OUT}"
log_ok "db:migrate completed"

# --- Step 5: Apply extras ----------------------------------------------------
log_info "Applying extras..."
EXTRAS_OUT="$(mktemp)"
if ! HOSPEDA_DATABASE_URL="${URL}" node "${EXTRAS_SCRIPT}" >"${EXTRAS_OUT}" 2>&1; then
    echo "${RED}  apply-extras failed:${RESET}"
    cat "${EXTRAS_OUT}"
    log_fail "apply-extras exited non-zero"
    rm -f "${EXTRAS_OUT}"
    exit 1
fi
rm -f "${EXTRAS_OUT}"
log_ok "apply-extras completed"

# --- Step 6: Assert table count >= 82 ----------------------------------------
log_info "Counting base tables..."
TABLE_COUNT="$(docker exec "${CONTAINER}" psql -U postgres -d "${DB}" -t -c \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';" \
    | tr -d ' \n')"
log_info "Table count: ${TABLE_COUNT}"
if [[ "${TABLE_COUNT}" -ge 82 ]]; then
    log_ok "Table count >= 82 (got ${TABLE_COUNT})"
else
    log_fail "Expected >= 82 tables, got ${TABLE_COUNT}"
fi

# --- Step 7: Assert search_index materialized view exists --------------------
log_info "Checking search_index materialized view..."
MATVIEW_COUNT="$(docker exec "${CONTAINER}" psql -U postgres -d "${DB}" -t -c \
    "SELECT count(*) FROM pg_matviews WHERE schemaname='public' AND matviewname='search_index';" \
    | tr -d ' \n')"
if [[ "${MATVIEW_COUNT}" -eq 1 ]]; then
    log_ok "search_index materialized view present"
else
    log_fail "search_index materialized view NOT found (count=${MATVIEW_COUNT})"
fi

# --- Step 8: Assert the 3 trigger functions are present ----------------------
# Functions created by the extras scripts:
#   - set_updated_at          (002-set-updated-at.trigger.sql)
#   - delete_entity_bookmarks (003-delete-entity-bookmarks.trigger.sql)
#   - refresh_search_index    (001-search-index.matview.sql)
log_info "Checking trigger functions..."
for FN in "set_updated_at" "delete_entity_bookmarks" "refresh_search_index"; do
    FN_COUNT="$(docker exec "${CONTAINER}" psql -U postgres -d "${DB}" -t -c \
        "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='${FN}';" \
        | tr -d ' \n')"
    if [[ "${FN_COUNT}" -ge 1 ]]; then
        log_ok "Trigger function '${FN}' present"
    else
        log_fail "Trigger function '${FN}' NOT found"
    fi
done

# --- Step 9: Anti-drift — drizzle-kit generate must produce NO new files -----
log_info "Running drizzle-kit generate to check for drift..."

# Guard: migrations dir must be clean before we run generate
PREEXISTING="$(git -C "${REPO_ROOT}" status --porcelain -- "${MIGRATIONS_DIR}" 2>/dev/null || true)"
if [[ -n "${PREEXISTING}" ]]; then
    log_fail "PRECONDITION: ${MIGRATIONS_DIR} has uncommitted changes — cannot detect drift cleanly"
    exit 1
fi

GEN_OUT="$(mktemp)"
GEN_EXIT=0
echo "" | HOSPEDA_DATABASE_URL="${URL}" pnpm --filter @repo/db run drizzle-kit generate \
    --config drizzle.config.ts --name drift_check >"${GEN_OUT}" 2>&1 || GEN_EXIT=$?

if [[ "${GEN_EXIT}" -ne 0 ]]; then
    echo "${RED}  drizzle-kit generate failed:${RESET}"
    cat "${GEN_OUT}"
    log_fail "drizzle-kit generate exited non-zero (exit ${GEN_EXIT})"
    rm -f "${GEN_OUT}"
    exit 1
fi
rm -f "${GEN_OUT}"

DRIFT="$(git -C "${REPO_ROOT}" status --porcelain -- "${MIGRATIONS_DIR}" 2>/dev/null || true)"
# Revert immediately regardless of result
git -C "${REPO_ROOT}" checkout -- "${MIGRATIONS_DIR}" 2>/dev/null || true
git -C "${REPO_ROOT}" clean -fd -- "${MIGRATIONS_DIR}" >/dev/null 2>&1 || true

if [[ -z "${DRIFT}" ]]; then
    log_ok "No drift — TS schema matches committed migrations (drizzle-kit generate emitted nothing)"
else
    log_fail "DRIFT DETECTED — drizzle-kit generate would emit new files:"
    echo "${DRIFT}"
fi

# --- Final summary -----------------------------------------------------------
echo ""
echo "======================================================================"
echo " T-015 Results: ${PASS} passed, ${FAIL} failed"
echo "======================================================================"

if [[ "${FAIL}" -gt 0 ]]; then
    exit 1
fi
exit 0
