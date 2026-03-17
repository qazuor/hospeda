#!/usr/bin/env bash
# =============================================================================
# apply-postgres-extras.sh
#
# Applies all PostgreSQL features that Drizzle ORM cannot declare natively:
#   - Materialized view: search_index (migrations 0016-0018)
#   - Triggers: set_updated_at, delete_entity_bookmarks (migrations 0019-0020)
#   - CHECK constraints on billing_addon_purchases (migrations 0025-0026)
#
# This script is IDEMPOTENT. Every statement uses IF NOT EXISTS or
# CREATE OR REPLACE, so it is safe to run multiple times.
#
# Usage:
#   # Reads DATABASE_URL from environment
#   packages/db/scripts/apply-postgres-extras.sh
#
#   # Pass DATABASE_URL explicitly as first argument
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
DB_URL="${1:-${DATABASE_URL:-${HOSPEDA_DATABASE_URL:-}}}"

if [[ -z "${DB_URL}" ]]; then
  echo "ERROR: No database URL provided." >&2
  echo "  Set HOSPEDA_DATABASE_URL or DATABASE_URL in your environment," >&2
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

# ------------------------------------------------------------
# Step 1: Materialized view — search_index
# Migration: manual/0016_create_search_index.sql
# ------------------------------------------------------------
echo "[1/7] Materialized view: search_index"
run_file \
  "search_index materialized view (0016)" \
  "${MANUAL_DIR}/0016_create_search_index.sql"
echo ""

# ------------------------------------------------------------
# Step 2: GIN index on search_index.tsv
# Migration: manual/0017_create_search_index_gin.sql
# ------------------------------------------------------------
echo "[2/7] GIN index: idx_search_index_tsv"
run_file \
  "GIN index on search_index.tsv (0017)" \
  "${MANUAL_DIR}/0017_create_search_index_gin.sql"
echo ""

# ------------------------------------------------------------
# Step 3: refresh_search_index() function
# Migration: manual/0018_refresh_search_index_function.sql
# Note: Only the CREATE OR REPLACE FUNCTION statement is applied.
# The optional pg_cron schedule (commented out in the file) is skipped.
# ------------------------------------------------------------
echo "[3/7] Function: refresh_search_index()"
run_file \
  "refresh_search_index function (0018)" \
  "${MANUAL_DIR}/0018_refresh_search_index_function.sql"
echo ""

# ------------------------------------------------------------
# Step 4: set_updated_at trigger (generic, all tables with updated_at)
# Migration: manual/0019_add_generic_updated_at_trigger.sql
#
# IMPORTANT: this migration attaches the trigger to all tables in the
# public schema that have an updated_at column AT THE TIME IT RUNS.
# Re-run this script if new tables are added later.
# ------------------------------------------------------------
echo "[4/7] Trigger function + triggers: set_updated_at"
echo "  NOTE: Trigger will be attached to all tables with updated_at column"

# The DO block in 0019 uses EXECUTE format() which will fail with
# --single-transaction if a trigger already exists. We wrap the DO block
# to make each individual CREATE TRIGGER idempotent using IF NOT EXISTS
# via a modified inline block instead of the raw file.
run_sql \
  "set_updated_at function (0019)" \
  "CREATE OR REPLACE FUNCTION set_updated_at()
     RETURNS TRIGGER AS \$\$
   BEGIN
     IF TG_OP = 'UPDATE' THEN
       BEGIN
         NEW.updated_at := NOW();
       EXCEPTION WHEN undefined_column THEN
         NULL;
       END;
     END IF;
     RETURN NEW;
   END;
   \$\$ LANGUAGE plpgsql;"

run_sql \
  "set_updated_at triggers on all tables (0019)" \
  "DO \$\$
   DECLARE
     tbl RECORD;
   BEGIN
     FOR tbl IN
       SELECT table_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND column_name = 'updated_at'
     LOOP
       IF NOT EXISTS (
         SELECT 1 FROM information_schema.triggers
         WHERE trigger_schema = 'public'
           AND event_object_table = tbl.table_name
           AND trigger_name = 'trg_set_updated_at_' || tbl.table_name
       ) THEN
         EXECUTE format(\$fmt\$
           CREATE TRIGGER trg_set_updated_at_%1\$I
             BEFORE UPDATE ON public.%1\$I
             FOR EACH ROW
             EXECUTE FUNCTION set_updated_at();
         \$fmt\$, tbl.table_name);
       END IF;
     END LOOP;
   END;
   \$\$;"

echo ""

# ------------------------------------------------------------
# Step 5: delete_entity_bookmarks trigger
# Migration: manual/0020_add_delete_entity_bookmarks_trigger.sql
#
# This file uses DROP TRIGGER IF EXISTS + CREATE TRIGGER, so it is
# already idempotent. Run it directly.
# ------------------------------------------------------------
echo "[5/7] Trigger function + triggers: delete_entity_bookmarks"
run_file \
  "delete_entity_bookmarks trigger (0020)" \
  "${MANUAL_DIR}/0020_add_delete_entity_bookmarks_trigger.sql"
echo ""

# ------------------------------------------------------------
# Step 6: CHECK constraint — billing_addon_purchases.status
# Migration: 0025_addon_purchases_status_check.sql
#
# ALTER TABLE ADD CONSTRAINT fails if the constraint already exists.
# Wrap in a DO block to make it idempotent.
# ------------------------------------------------------------
echo "[6/7] CHECK constraint: billing_addon_purchases_status_check"
run_sql \
  "status CHECK constraint (0025)" \
  "DO \$\$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'billing_addon_purchases_status_check'
         AND conrelid = 'billing_addon_purchases'::regclass
     ) THEN
       ALTER TABLE billing_addon_purchases
         ADD CONSTRAINT billing_addon_purchases_status_check
         CHECK (status IN ('active', 'expired', 'canceled', 'pending'));
     END IF;
   END;
   \$\$;"
echo ""

# ------------------------------------------------------------
# Step 7: CHECK constraints — billing_addon_purchases JSONB columns
# Migration: 0026_addon_purchases_jsonb_check.sql
# ------------------------------------------------------------
echo "[7/7] CHECK constraints: chk_limit_adjustments_type + chk_entitlement_adjustments_type"
run_sql \
  "limit_adjustments JSONB CHECK constraint (0026)" \
  "DO \$\$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'chk_limit_adjustments_type'
         AND conrelid = 'billing_addon_purchases'::regclass
     ) THEN
       ALTER TABLE billing_addon_purchases
         ADD CONSTRAINT chk_limit_adjustments_type
         CHECK (limit_adjustments IS NULL OR jsonb_typeof(limit_adjustments) = 'array');
     END IF;
   END;
   \$\$;"

run_sql \
  "entitlement_adjustments JSONB CHECK constraint (0026)" \
  "DO \$\$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'chk_entitlement_adjustments_type'
         AND conrelid = 'billing_addon_purchases'::regclass
     ) THEN
       ALTER TABLE billing_addon_purchases
         ADD CONSTRAINT chk_entitlement_adjustments_type
         CHECK (entitlement_adjustments IS NULL OR jsonb_typeof(entitlement_adjustments) = 'array');
     END IF;
   END;
   \$\$;"

echo ""

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
