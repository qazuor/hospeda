#!/usr/bin/env bash
# =============================================================================
# migrate-production.sh
#
# Production database migration script for the Hospeda platform.
# Performs a safe database migration using Drizzle ORM (drizzle-kit push)
# with pre-migration backup and verification.
#
# Usage:
#   ./scripts/migrate-production.sh [OPTIONS]
#
# Options:
#   --dry-run       Show current schema status without applying changes
#   --skip-backup   Skip the pg_dump backup step before migrating
#   -h, --help      Show this help message
#
# Environment:
#   HOSPEDA_DATABASE_URL  Required. PostgreSQL connection string.
#
# The script will:
#   1. Validate environment and dependencies
#   2. Create a timestamped pg_dump backup (unless --skip-backup)
#   3. Run drizzle-kit push to synchronize the database schema
#   4. Verify migration success
#   5. Print a summary with backup location and duration
# =============================================================================

set -euo pipefail

# -- Constants ----------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_DIR="${REPO_ROOT}/backups"
MIGRATIONS_DIR="${REPO_ROOT}/packages/db/src/migrations"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/hospeda_backup_${TIMESTAMP}.sql.gz"

# -- Flags --------------------------------------------------------------------

DRY_RUN=false
SKIP_BACKUP=false

# -- Functions ----------------------------------------------------------------

print_header() {
    echo ""
    echo "=============================================="
    echo "  Hospeda - Production Database Migration"
    echo "=============================================="
    echo ""
}

print_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --dry-run       Show current schema status without applying changes"
    echo "  --skip-backup   Skip the pg_dump backup step before migrating"
    echo "  -h, --help      Show this help message"
    echo ""
    echo "Environment:"
    echo "  HOSPEDA_DATABASE_URL  Required. PostgreSQL connection string."
}

log_info() {
    echo "[INFO]  $1"
}

log_warn() {
    echo "[WARN]  $1"
}

log_error() {
    echo "[ERROR] $1" >&2
}

log_success() {
    echo "[OK]    $1"
}

# Extract database name from connection URL for display purposes.
# Supports both postgresql:// and postgres:// schemes.
get_db_name() {
    echo "${HOSPEDA_DATABASE_URL}" | sed -E 's|.*://[^/]+/([^?]+).*|\1|'
}

# -- Parse arguments ----------------------------------------------------------

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            print_usage
            exit 1
            ;;
    esac
done

# -- Main ---------------------------------------------------------------------

print_header

START_TIME=$(date +%s)

# 1. Validate environment variables
log_info "Validating environment..."

if [[ -z "${HOSPEDA_DATABASE_URL:-}" ]]; then
    log_error "HOSPEDA_DATABASE_URL is not set."
    log_error "Export it before running this script:"
    log_error "  export HOSPEDA_DATABASE_URL='postgresql://user:pass@host:5432/dbname'"
    exit 1
fi

DB_NAME="$(get_db_name)"
log_success "HOSPEDA_DATABASE_URL is set (database: ${DB_NAME})"

# 2. Validate dependencies
if ! command -v pnpm &>/dev/null; then
    log_error "pnpm is not installed or not in PATH."
    exit 1
fi
log_success "pnpm is available"

if [[ "${SKIP_BACKUP}" == false ]]; then
    if ! command -v pg_dump &>/dev/null; then
        log_error "pg_dump is not installed or not in PATH."
        log_error "Install postgresql-client or use --skip-backup to skip the backup step."
        exit 1
    fi
    log_success "pg_dump is available"
fi

# 3. Show migration files info
log_info "Checking migrations directory..."

if [[ -d "${MIGRATIONS_DIR}" ]]; then
    SQL_COUNT=$(find "${MIGRATIONS_DIR}" -maxdepth 1 -name '*.sql' -type f | wc -l)
    log_info "Migration files found in packages/db/src/migrations/: ${SQL_COUNT} SQL files"
else
    log_warn "Migrations directory not found at ${MIGRATIONS_DIR}"
    SQL_COUNT=0
fi

# 4. Dry-run mode: show status and exit
if [[ "${DRY_RUN}" == true ]]; then
    echo ""
    log_info "=== DRY RUN MODE ==="
    log_info "Database: ${DB_NAME}"
    log_info "Migration SQL files on disk: ${SQL_COUNT}"
    log_info ""
    log_info "Running schema check (no changes will be applied)..."
    echo ""

    # Use drizzle-kit push with --strict to show what would change without applying.
    # Note: drizzle-kit push does not have a native dry-run flag,
    # so we use the check command if available, otherwise just report status.
    cd "${REPO_ROOT}"
    if pnpm --filter @repo/db drizzle-kit check --config drizzle.config.ts 2>/dev/null; then
        log_success "Schema check completed."
    else
        log_info "Schema check command not available. Use 'pnpm db:studio' to inspect the current state."
    fi

    echo ""
    log_info "No changes were applied (dry-run mode)."
    log_info "Remove --dry-run to apply migrations."
    exit 0
fi

# 5. Create backup
if [[ "${SKIP_BACKUP}" == true ]]; then
    log_warn "Skipping database backup (--skip-backup flag set)"
else
    log_info "Creating database backup..."

    mkdir -p "${BACKUP_DIR}"

    if pg_dump "${HOSPEDA_DATABASE_URL}" --no-owner --no-acl --clean --if-exists | gzip > "${BACKUP_FILE}"; then
        BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
        log_success "Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"
    else
        log_error "Backup failed. Aborting migration."
        log_error "Fix the backup issue or use --skip-backup to proceed without a backup."
        # Clean up partial backup file
        rm -f "${BACKUP_FILE}"
        exit 1
    fi
fi

# 6. Run migration
echo ""
log_info "Running database migration..."
log_info "Command: pnpm --filter @repo/db db:migrate"
echo ""

cd "${REPO_ROOT}"

if pnpm --filter @repo/db db:migrate; then
    echo ""
    log_success "Migration completed successfully."
else
    MIGRATION_EXIT_CODE=$?
    echo ""
    log_error "Migration FAILED (exit code: ${MIGRATION_EXIT_CODE})"
    echo ""

    if [[ "${SKIP_BACKUP}" == false ]] && [[ -f "${BACKUP_FILE}" ]]; then
        log_error "=================================================="
        log_error "  MANUAL ROLLBACK INSTRUCTIONS"
        log_error "=================================================="
        log_error ""
        log_error "A backup was created before the migration attempt."
        log_error "To restore the database to its previous state:"
        log_error ""
        log_error "  1. Decompress and restore the backup:"
        log_error ""
        log_error "     gunzip -c ${BACKUP_FILE} | psql \"\${HOSPEDA_DATABASE_URL}\""
        log_error ""
        log_error "  2. Verify the restore:"
        log_error ""
        log_error "     psql \"\${HOSPEDA_DATABASE_URL}\" -c '\\dt'"
        log_error ""
        log_error "  3. Investigate the migration failure in the logs above."
        log_error ""
        log_error "=================================================="
    else
        log_error "No backup was created. Manual investigation required."
        log_error "Check the migration output above for details."
    fi

    exit "${MIGRATION_EXIT_CODE}"
fi

# 7. Post-migration verification
log_info "Verifying migration..."

if psql "${HOSPEDA_DATABASE_URL}" -c "SELECT 1;" &>/dev/null; then
    log_success "Database connection verified after migration."
else
    log_warn "Could not verify database connection. Check manually."
fi

# 8. Summary
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "=============================================="
echo "  Migration Summary"
echo "=============================================="
echo ""
echo "  Database:          ${DB_NAME}"
echo "  Duration:          ${DURATION} seconds"
echo "  Migration files:   ${SQL_COUNT} SQL files on disk"

if [[ "${SKIP_BACKUP}" == false ]] && [[ -f "${BACKUP_FILE}" ]]; then
    echo "  Backup location:   ${BACKUP_FILE}"
    echo "  Backup size:       ${BACKUP_SIZE}"
else
    echo "  Backup:            skipped"
fi

echo "  Status:            SUCCESS"
echo ""
echo "=============================================="
echo ""
