#!/usr/bin/env bash
# =============================================================================
# T-016 — Idempotency test  (SPEC-178)
#
# Proves:
#   Running db:migrate twice and apply-extras twice on the same DB is a clean
#   no-op the second time (exit 0, no errors, no schema change).
#
# Method:
#   1. Start ephemeral Postgres container.
#   2. Apply extensions + db:migrate + apply-extras (first pass).
#   3. Capture a schema fingerprint:
#        - count of tables, indexes, constraints, matviews, triggers
#   4. Apply db:migrate + apply-extras again (second pass).
#   5. Capture the fingerprint again.
#   6. Assert both passes exited 0 AND the fingerprints are identical.
#
# Usage:
#   bash packages/db/test/migrations/t016-idempotency.sh
#   (Run from the repo root)
#
# Exit codes: 0 = all assertions pass; 1 = at least one assertion failed.
# =============================================================================
set -euo pipefail

CONTAINER="spec178-idem"
PORT=55442
DB="t"
URL="postgresql://postgres:test@localhost:${PORT}/${DB}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"
PKG_DIR="${REPO_ROOT}/packages/db"
EXTRAS_SCRIPT="${PKG_DIR}/scripts/apply-postgres-extras.mjs"

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
}
trap cleanup EXIT

echo ""
echo "======================================================================"
echo " T-016 — Idempotency"
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

# --- Step 2: Wait for REAL readiness -----------------------------------------
log_info "Waiting for Postgres to accept queries..."
if ! timeout 90 bash -c "until docker exec ${CONTAINER} psql -U postgres -d ${DB} -c \"SELECT 1\" >/dev/null 2>&1; do :; done"; then
    log_fail "Postgres did not become ready within 90s"
    exit 1
fi
log_ok "Postgres ready"

# --- Step 3: Install extensions ----------------------------------------------
log_info "Installing extensions..."
docker exec "${CONTAINER}" psql -U postgres -d "${DB}" -c \
    'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS "pgcrypto"; CREATE EXTENSION IF NOT EXISTS "unaccent";' \
    >/dev/null
log_ok "Extensions installed"

# --- Helper: capture fingerprint ---------------------------------------------
# Returns a multi-line string: "tables=N indexes=N constraints=N matviews=N triggers=N"
get_fingerprint() {
    local tables indexes constraints matviews triggers

    tables="$(docker exec "${CONTAINER}" psql -U postgres -d "${DB}" -t -c \
        "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';" \
        | tr -d ' \n')"

    indexes="$(docker exec "${CONTAINER}" psql -U postgres -d "${DB}" -t -c \
        "SELECT count(*) FROM pg_indexes WHERE schemaname='public';" \
        | tr -d ' \n')"

    constraints="$(docker exec "${CONTAINER}" psql -U postgres -d "${DB}" -t -c \
        "SELECT count(*) FROM information_schema.table_constraints WHERE constraint_schema='public';" \
        | tr -d ' \n')"

    matviews="$(docker exec "${CONTAINER}" psql -U postgres -d "${DB}" -t -c \
        "SELECT count(*) FROM pg_matviews WHERE schemaname='public';" \
        | tr -d ' \n')"

    triggers="$(docker exec "${CONTAINER}" psql -U postgres -d "${DB}" -t -c \
        "SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal;" \
        | tr -d ' \n')"

    echo "tables=${tables} indexes=${indexes} constraints=${constraints} matviews=${matviews} triggers=${triggers}"
}

# --- Helper: apply migrate + extras ------------------------------------------
run_apply() {
    local pass_label="$1"
    local out
    out="$(mktemp)"

    log_info "[${pass_label}] Running db:migrate..."
    if ! HOSPEDA_DATABASE_URL="${URL}" pnpm --filter @repo/db db:migrate >"${out}" 2>&1; then
        echo "${RED}  db:migrate failed (${pass_label}):${RESET}"
        cat "${out}"
        rm -f "${out}"
        log_fail "db:migrate exited non-zero (${pass_label})"
        return 1
    fi
    rm -f "${out}"
    log_ok "[${pass_label}] db:migrate: exit 0"

    out="$(mktemp)"
    log_info "[${pass_label}] Applying extras..."
    if ! HOSPEDA_DATABASE_URL="${URL}" node "${EXTRAS_SCRIPT}" >"${out}" 2>&1; then
        echo "${RED}  apply-extras failed (${pass_label}):${RESET}"
        cat "${out}"
        rm -f "${out}"
        log_fail "apply-extras exited non-zero (${pass_label})"
        return 1
    fi
    rm -f "${out}"
    log_ok "[${pass_label}] apply-extras: exit 0"
    return 0
}

# --- Pass 1 ------------------------------------------------------------------
echo ""
log_info "=== Pass 1 ==="
run_apply "Pass 1"
FP1="$(get_fingerprint)"
log_info "Fingerprint after pass 1: ${FP1}"

# --- Pass 2 ------------------------------------------------------------------
echo ""
log_info "=== Pass 2 (second apply — must be no-op) ==="
run_apply "Pass 2"
FP2="$(get_fingerprint)"
log_info "Fingerprint after pass 2: ${FP2}"

# --- Assert fingerprints are identical ----------------------------------------
echo ""
if [[ "${FP1}" == "${FP2}" ]]; then
    log_ok "Fingerprint unchanged after second apply: ${FP1}"
else
    log_fail "Fingerprint CHANGED after second apply"
    echo "  Before: ${FP1}"
    echo "  After:  ${FP2}"
fi

# --- Final summary -----------------------------------------------------------
echo ""
echo "======================================================================"
echo " T-016 Results: ${PASS} passed, ${FAIL} failed"
echo "======================================================================"

if [[ "${FAIL}" -gt 0 ]]; then
    exit 1
fi
exit 0
