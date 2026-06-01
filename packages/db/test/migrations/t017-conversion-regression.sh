#!/usr/bin/env bash
# =============================================================================
# T-017 — Conversion regression test  (SPEC-178)
#
# Proves the class of bug that started SPEC-178:
#   The `name` text→jsonb cast that failed without a USING clause.
#
# This test guards future data conversions. It documents WHY USING is
# mandatory for type changes that require data reshaping.
#
# Assertions:
#   A. NAIVE cast (no USING) of text→jsonb FAILS with a clear Postgres error.
#   B. USING cast (with jsonb_build_object) SUCCEEDS and data is preserved +
#      correctly reshaped into i18n jsonb: {"es": original, "en": original, "pt": original}
#
# Method:
#   1. Start ephemeral Postgres container (no Drizzle schema needed — test is
#      self-contained with a minimal table).
#   2. Create a table with a TEXT column, insert 3 rows.
#   3. Attempt ALTER COLUMN ... TYPE jsonb (no USING) — must FAIL.
#   4. Re-create the table with fresh TEXT data.
#   5. Apply ALTER COLUMN ... TYPE jsonb USING jsonb_build_object(...) — must SUCCEED.
#   6. Assert data is preserved and correctly reshaped.
#
# Usage:
#   bash packages/db/test/migrations/t017-conversion-regression.sh
#   (Run from the repo root)
#
# Exit codes: 0 = all assertions pass; 1 = at least one assertion failed.
# =============================================================================
set -euo pipefail

CONTAINER="spec178-conv"
PORT=55443
DB="t"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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
echo " T-017 — Conversion regression (USING preserves data)"
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

# --- Helper: run psql and capture exit code without aborting script ----------
# Returns exit code via global PSQL_EXIT
psql_cmd() {
    local sql="$1"
    PSQL_EXIT=0
    PSQL_OUT="$(docker exec "${CONTAINER}" psql -U postgres -d "${DB}" -c "${sql}" 2>&1)" || PSQL_EXIT=$?
}

# --- Assertion A: NAIVE cast MUST FAIL ---------------------------------------
echo ""
log_info "=== Assertion A: Naive cast (no USING) must fail ==="

# Create table with text column + 3 rows
psql_cmd "DROP TABLE IF EXISTS items; CREATE TABLE items (id serial PRIMARY KEY, name text NOT NULL);"
if [[ "${PSQL_EXIT}" -ne 0 ]]; then
    log_fail "Setup: could not create items table: ${PSQL_OUT}"
    exit 1
fi
log_ok "Created items table with TEXT name column"

psql_cmd "INSERT INTO items (name) VALUES ('Hotel Paraíso'), ('Cabaña del Sur'), ('Departamento Centro');"
if [[ "${PSQL_EXIT}" -ne 0 ]]; then
    log_fail "Setup: could not insert rows: ${PSQL_OUT}"
    exit 1
fi
log_ok "Inserted 3 rows"

# Attempt naive cast — should FAIL
log_info "Attempting ALTER COLUMN name TYPE jsonb (no USING)..."
psql_cmd "ALTER TABLE items ALTER COLUMN name TYPE jsonb;"

if [[ "${PSQL_EXIT}" -ne 0 ]]; then
    # Expected: Postgres error about cast
    log_ok "Naive cast (no USING) failed as expected (exit ${PSQL_EXIT})"
    # Log the error for documentation
    log_info "Error message: $(echo "${PSQL_OUT}" | head -3)"
else
    log_fail "Naive cast succeeded when it should have failed — test assumption wrong!"
    log_info "Output: ${PSQL_OUT}"
fi

# --- Assertion B: USING cast MUST SUCCEED and preserve data ------------------
echo ""
log_info "=== Assertion B: USING cast must succeed and reshape data ==="

# Re-create the table fresh (naive cast may have partially altered it)
psql_cmd "DROP TABLE IF EXISTS items; CREATE TABLE items (id serial PRIMARY KEY, name text NOT NULL);"
if [[ "${PSQL_EXIT}" -ne 0 ]]; then
    log_fail "Re-setup: could not recreate items table: ${PSQL_OUT}"
    exit 1
fi
log_ok "Recreated items table with TEXT name column"

psql_cmd "INSERT INTO items (name) VALUES ('Hotel Paraíso'), ('Cabaña del Sur'), ('Departamento Centro');"
if [[ "${PSQL_EXIT}" -ne 0 ]]; then
    log_fail "Re-setup: could not insert rows: ${PSQL_OUT}"
    exit 1
fi
log_ok "Inserted 3 rows"

# Apply USING cast — mirrors manual 0029's pattern
log_info "Applying ALTER COLUMN name TYPE jsonb USING jsonb_build_object('es', name, 'en', name, 'pt', name)..."
psql_cmd "ALTER TABLE items ALTER COLUMN name TYPE jsonb USING jsonb_build_object('es', name, 'en', name, 'pt', name);"

if [[ "${PSQL_EXIT}" -eq 0 ]]; then
    log_ok "USING cast succeeded (exit 0)"
else
    log_fail "USING cast failed (exit ${PSQL_EXIT}): ${PSQL_OUT}"
    exit 1
fi

# Assert row count is preserved
ROW_COUNT="$(docker exec "${CONTAINER}" psql -U postgres -d "${DB}" -t -c \
    "SELECT count(*) FROM items;" | tr -d ' \n')"
if [[ "${ROW_COUNT}" -eq 3 ]]; then
    log_ok "Row count preserved: 3 rows"
else
    log_fail "Row count changed: expected 3, got ${ROW_COUNT}"
fi

# Assert column type is now jsonb
COL_TYPE="$(docker exec "${CONTAINER}" psql -U postgres -d "${DB}" -t -c \
    "SELECT udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='items' AND column_name='name';" \
    | tr -d ' \n')"
if [[ "${COL_TYPE}" == "jsonb" ]]; then
    log_ok "Column type is now jsonb"
else
    log_fail "Column type expected 'jsonb', got '${COL_TYPE}'"
fi

# Assert data was reshaped: each row should have es, en, pt keys with the original value
log_info "Checking i18n reshaping for each row..."

# NOTE: psql -t output has leading/trailing whitespace but NOT spaces within the value.
# We use `xargs` (not `tr -d ' \n'`) to trim leading/trailing whitespace safely
# without clobbering internal spaces (e.g. "Hotel Paraíso" has a space).
psql_val() {
    docker exec "${CONTAINER}" psql -U postgres -d "${DB}" -t -c "$1" | xargs
}

# Row 1: Hotel Paraiso (ASCII-safe for shell comparison; the DB value has the accent)
ES1="$(psql_val "SELECT name->>'es' FROM items WHERE id=1;")"
EN1="$(psql_val "SELECT name->>'en' FROM items WHERE id=1;")"
PT1="$(psql_val "SELECT name->>'pt' FROM items WHERE id=1;")"

EXPECTED1="Hotel Paraíso"
if [[ "${ES1}" == "${EXPECTED1}" && "${EN1}" == "${EXPECTED1}" && "${PT1}" == "${EXPECTED1}" ]]; then
    log_ok "Row 1 '${EXPECTED1}': es/en/pt all correct"
else
    log_fail "Row 1 reshaping mismatch: es='${ES1}', en='${EN1}', pt='${PT1}' (expected '${EXPECTED1}' in all)"
fi

# Row 2: Cabaña del Sur
ES2="$(psql_val "SELECT name->>'es' FROM items WHERE id=2;")"
EN2="$(psql_val "SELECT name->>'en' FROM items WHERE id=2;")"
PT2="$(psql_val "SELECT name->>'pt' FROM items WHERE id=2;")"

EXPECTED2="Cabaña del Sur"
if [[ "${ES2}" == "${EXPECTED2}" && "${EN2}" == "${EXPECTED2}" && "${PT2}" == "${EXPECTED2}" ]]; then
    log_ok "Row 2 '${EXPECTED2}': es/en/pt all correct"
else
    log_fail "Row 2 reshaping mismatch: es='${ES2}', en='${EN2}', pt='${PT2}' (expected '${EXPECTED2}' in all)"
fi

# Row 3: Departamento Centro
ES3="$(psql_val "SELECT name->>'es' FROM items WHERE id=3;")"

EXPECTED3="Departamento Centro"
if [[ "${ES3}" == "${EXPECTED3}" ]]; then
    log_ok "Row 3 '${EXPECTED3}': es='${ES3}' correct"
else
    log_fail "Row 3 reshaping mismatch: es='${ES3}' (expected '${EXPECTED3}')"
fi

# Assert full jsonb shape via ->> operator on all keys at once
SHAPE_CHECK="$(docker exec "${CONTAINER}" psql -U postgres -d "${DB}" -t -c \
    "SELECT count(*) FROM items WHERE name ? 'es' AND name ? 'en' AND name ? 'pt';" \
    | tr -d ' \n')"
if [[ "${SHAPE_CHECK}" -eq 3 ]]; then
    log_ok "All 3 rows have es/en/pt keys in jsonb"
else
    log_fail "Only ${SHAPE_CHECK}/3 rows have all i18n keys"
fi

# --- Final summary -----------------------------------------------------------
echo ""
echo "======================================================================"
echo " T-017 Results: ${PASS} passed, ${FAIL} failed"
echo "======================================================================"

if [[ "${FAIL}" -gt 0 ]]; then
    exit 1
fi
exit 0
