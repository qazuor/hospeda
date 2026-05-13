#!/usr/bin/env bash
#
# postgres-to-r2.sh
#
# Daily backup of the Hospeda PostgreSQL database to Cloudflare R2.
#
# Runs `pg_dump` inside the Postgres Docker container via `docker exec`,
# captures the custom-format compressed dump locally, uploads it to the
# configured R2 bucket via aws-cli (S3-compatible), then removes the local
# file.
#
# Configuration is read from /etc/hospeda-backup.env (or
# $HOSPEDA_BACKUP_ENV_FILE if set). See .env.example for required vars.
#
# Exit codes:
#   0 - success
#   1 - configuration error (missing env / file)
#   2 - dump failed or produced suspiciously small file
#   3 - upload to R2 failed
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

# Required variables — fail fast if any is missing or empty.
: "${R2_ACCOUNT_ID:?R2_ACCOUNT_ID required in $ENV_FILE}"
: "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID required in $ENV_FILE}"
: "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY required in $ENV_FILE}"
: "${R2_BUCKET:?R2_BUCKET required in $ENV_FILE}"
: "${POSTGRES_CONTAINER:?POSTGRES_CONTAINER required in $ENV_FILE}"
: "${POSTGRES_USER:?POSTGRES_USER required in $ENV_FILE}"
: "${POSTGRES_DB:?POSTGRES_DB required in $ENV_FILE}"

# Optional overrides with defaults.
BACKUP_DIR="${BACKUP_DIR:-/var/tmp/hospeda-backups}"
MIN_BACKUP_SIZE="${MIN_BACKUP_SIZE:-100000}" # 100 KB — a real Hospeda backup is at least 1-2 MB

# SPEC-103 T-078: GPG symmetric encryption. When BACKUP_PASSPHRASE is set
# in the env file, pg_dump output is piped through gpg --symmetric
# (AES256) before landing on disk + uploading to R2. The resulting file
# carries a .dump.gpg suffix. db-restore detects the suffix and pipes
# through gpg --decrypt before pg_restore. When unset, the script
# behaves identically to the pre-T-078 version (raw dumps in R2) and
# logs a clear warning so the operator knows encryption is disabled.
ENCRYPT_BACKUPS="false"
if [[ -n "${BACKUP_PASSPHRASE:-}" ]]; then
    ENCRYPT_BACKUPS="true"
fi

# -----------------------------------------------------------------------------
# Derived values
# -----------------------------------------------------------------------------
TIMESTAMP=$(date -u +"%Y-%m-%d_%H%M%SZ")
BACKUP_BASENAME="hospeda-postgres-${TIMESTAMP}.dump"
if [[ "$ENCRYPT_BACKUPS" == "true" ]]; then
    BACKUP_NAME="${BACKUP_BASENAME}.gpg"
else
    BACKUP_NAME="$BACKUP_BASENAME"
fi
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_NAME}"
R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# Logger writes ISO-8601 UTC timestamps so log lines are easy to grep.
log() {
    echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"
}

# -----------------------------------------------------------------------------
# Backup
# -----------------------------------------------------------------------------
mkdir -p "$BACKUP_DIR"

log "Starting backup: ${BACKUP_NAME}"
log "Source: container=${POSTGRES_CONTAINER} db=${POSTGRES_DB} user=${POSTGRES_USER}"

if [[ "$ENCRYPT_BACKUPS" == "true" ]]; then
    log "Encryption: GPG symmetric AES256 (BACKUP_PASSPHRASE set)"
else
    log "WARNING: encryption DISABLED (BACKUP_PASSPHRASE not set in env file). Raw pg_dump will land in R2. Set BACKUP_PASSPHRASE to enable GPG AES256 symmetric encryption."
fi

# pg_dump inside the container, custom format (Fc) with built-in zlib
# compression. --no-owner / --no-privileges makes the dump portable across
# Postgres instances with different role layouts. When BACKUP_PASSPHRASE
# is set the dump is piped through `gpg --symmetric` before landing on
# disk; otherwise it lands raw (back-compat).
if [[ "$ENCRYPT_BACKUPS" == "true" ]]; then
    if ! docker exec "$POSTGRES_CONTAINER" \
        pg_dump \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        -Fc \
        --no-owner \
        --no-privileges \
        | gpg \
            --batch \
            --yes \
            --symmetric \
            --cipher-algo AES256 \
            --passphrase "$BACKUP_PASSPHRASE" \
            --output "$BACKUP_FILE"; then
        log "ERROR: pg_dump | gpg pipeline failed"
        rm -f "$BACKUP_FILE"
        exit 2
    fi
else
    if ! docker exec "$POSTGRES_CONTAINER" \
        pg_dump \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        -Fc \
        --no-owner \
        --no-privileges \
        >"$BACKUP_FILE"; then
        log "ERROR: pg_dump failed"
        rm -f "$BACKUP_FILE"
        exit 2
    fi
fi

# Sanity check: a real backup with seeds is at least 1-2 MB. Anything tiny
# is almost certainly a partial dump or an error written to stdout.
SIZE=$(stat -c%s "$BACKUP_FILE")

if [[ "$SIZE" -lt "$MIN_BACKUP_SIZE" ]]; then
    log "ERROR: backup too small (${SIZE} bytes < ${MIN_BACKUP_SIZE} minimum). Aborting upload."
    rm -f "$BACKUP_FILE"
    exit 2
fi

log "Backup created: ${BACKUP_FILE} (${SIZE} bytes)"

# -----------------------------------------------------------------------------
# Upload to R2
# -----------------------------------------------------------------------------
log "Uploading to R2 (s3://${R2_BUCKET}/${BACKUP_NAME})..."

if ! AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
    AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
    aws s3 cp \
    "$BACKUP_FILE" \
    "s3://${R2_BUCKET}/${BACKUP_NAME}" \
    --endpoint-url="$R2_ENDPOINT" \
    --no-progress; then
    log "ERROR: upload to R2 failed. Local backup preserved at ${BACKUP_FILE}"
    exit 3
fi

# -----------------------------------------------------------------------------
# Cleanup
# -----------------------------------------------------------------------------
rm -f "$BACKUP_FILE"

log "Backup completed successfully: ${BACKUP_NAME} (${SIZE} bytes)"

# -----------------------------------------------------------------------------
# Heartbeat ping (optional)
# -----------------------------------------------------------------------------
# Better Stack (or any heartbeat service) URL pinged on success so an external
# monitor can alert if the cron stops running. Failure to ping does NOT mark
# the backup as failed — the backup itself already succeeded.
if [[ -n "${BACKUP_HEARTBEAT_URL:-}" ]]; then
    log "Pinging heartbeat..."
    if curl -fsS --max-time 10 -o /dev/null "$BACKUP_HEARTBEAT_URL"; then
        log "Heartbeat ping OK"
    else
        log "WARNING: heartbeat ping failed (backup itself was successful)"
    fi
fi
