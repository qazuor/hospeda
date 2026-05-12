#!/usr/bin/env bash
#
# restore-from-r2.sh
#
# Restore the Hospeda PostgreSQL database from a backup stored in R2.
#
# DESTRUCTIVE: replaces the contents of the target database. The script asks
# for an explicit "YES" confirmation before running pg_restore.
#
# Usage:
#   # List available backups:
#   ./restore-from-r2.sh
#
#   # Restore a specific backup into the postgres database:
#   ./restore-from-r2.sh hospeda-postgres-2026-05-07_060000Z.dump
#
#   # Restore into a different database (e.g. for testing the backup):
#   ./restore-from-r2.sh hospeda-postgres-2026-05-07_060000Z.dump postgres_restore_test
#

set -euo pipefail

# -----------------------------------------------------------------------------
# Load configuration
# -----------------------------------------------------------------------------
ENV_FILE="${HOSPEDA_BACKUP_ENV_FILE:-/etc/hospeda-backup.env}"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "ERROR: env file not found: $ENV_FILE" >&2
    exit 1
fi

# shellcheck source=/dev/null
source "$ENV_FILE"

: "${R2_ACCOUNT_ID:?R2_ACCOUNT_ID required in $ENV_FILE}"
: "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID required in $ENV_FILE}"
: "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY required in $ENV_FILE}"
: "${R2_BUCKET:?R2_BUCKET required in $ENV_FILE}"
: "${POSTGRES_CONTAINER:?POSTGRES_CONTAINER required in $ENV_FILE}"
: "${POSTGRES_USER:?POSTGRES_USER required in $ENV_FILE}"
: "${POSTGRES_DB:?POSTGRES_DB required in $ENV_FILE}"

R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

BACKUP_FILE="${1:-}"
TARGET_DB="${2:-$POSTGRES_DB}"

# -----------------------------------------------------------------------------
# Listing mode
# -----------------------------------------------------------------------------
if [[ -z "$BACKUP_FILE" ]]; then
    echo "Available backups in s3://${R2_BUCKET}/:"
    echo ""
    AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
        AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
        aws s3 ls "s3://${R2_BUCKET}/" \
        --endpoint-url="$R2_ENDPOINT" |
        sort
    echo ""
    echo "Usage: $0 <backup_filename> [target_db]"
    echo "       Defaults: target_db=${POSTGRES_DB}"
    exit 0
fi

# -----------------------------------------------------------------------------
# Confirmation
# -----------------------------------------------------------------------------
echo "About to restore:"
echo "  Source backup : s3://${R2_BUCKET}/${BACKUP_FILE}"
echo "  Target DB     : ${TARGET_DB}"
echo "  Container     : ${POSTGRES_CONTAINER}"
echo ""
echo "WARNING: This is DESTRUCTIVE. All current data in '${TARGET_DB}' will be"
echo "REPLACED with the contents of the backup. Existing tables will be dropped"
echo "and recreated. Connections to the database may be terminated."
echo ""
read -r -p "Type 'YES' (uppercase) to confirm: " confirm

if [[ "$confirm" != "YES" ]]; then
    echo "Aborted."
    exit 1
fi

# -----------------------------------------------------------------------------
# Download
# -----------------------------------------------------------------------------
LOCAL_FILE="/var/tmp/${BACKUP_FILE}"

echo "Downloading from R2..."
AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
    AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
    aws s3 cp \
    "s3://${R2_BUCKET}/${BACKUP_FILE}" \
    "$LOCAL_FILE" \
    --endpoint-url="$R2_ENDPOINT" \
    --no-progress

SIZE=$(stat -c%s "$LOCAL_FILE")
echo "Downloaded: ${LOCAL_FILE} (${SIZE} bytes)"

# -----------------------------------------------------------------------------
# Restore
# -----------------------------------------------------------------------------
echo "Copying dump into container..."
docker cp "$LOCAL_FILE" "${POSTGRES_CONTAINER}:/tmp/restore.dump"

echo "Running pg_restore..."
# --clean --if-exists drops existing objects before recreating them. Combined
# with --no-owner / --no-privileges, this matches how the dump was produced.
docker exec "$POSTGRES_CONTAINER" \
    pg_restore \
    -U "$POSTGRES_USER" \
    -d "$TARGET_DB" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    /tmp/restore.dump

# -----------------------------------------------------------------------------
# Cleanup
# -----------------------------------------------------------------------------
docker exec "$POSTGRES_CONTAINER" rm -f /tmp/restore.dump
rm -f "$LOCAL_FILE"

echo ""
echo "Restore completed: ${BACKUP_FILE} -> ${TARGET_DB}"
echo ""
echo "Recommended next steps:"
echo "  1. Verify table counts match expected:"
echo "     docker exec ${POSTGRES_CONTAINER} psql -U ${POSTGRES_USER} -d ${TARGET_DB} \\"
echo "       -c \"SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE n_live_tup > 0 ORDER BY relname;\""
echo "  2. Restart the API container so it picks up the restored DB:"
echo "     (Coolify UI -> hospeda-api-prod -> Restart)"
