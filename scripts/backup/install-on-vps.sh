#!/usr/bin/env bash
#
# install-on-vps.sh
#
# Bootstraps the Hospeda Postgres backup tooling on the VPS.
#
# What it does:
#   1. Verifies dependencies (docker, awscli). Installs awscli if missing.
#   2. Creates /opt/hospeda-backup and copies the scripts there.
#   3. Creates /var/log/hospeda-backup.log with appropriate permissions.
#   4. Creates a logrotate config for the log file.
#   5. Prints the cron line you need to add via `crontab -e` (does NOT install
#      the cron entry automatically — that's a deliberate manual step so you
#      can audit the line before it runs).
#
# Run as root (sudo) on the VPS.
#

set -euo pipefail

if [[ "$EUID" -ne 0 ]]; then
    echo "ERROR: must be run as root (use sudo)." >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="/opt/hospeda-backup"
LOG_FILE="/var/log/hospeda-backup.log"
ENV_FILE="/etc/hospeda-backup.env"

# -----------------------------------------------------------------------------
# Dependency checks
# -----------------------------------------------------------------------------
echo "[1/5] Checking dependencies..."

if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: docker not found. Install Docker first." >&2
    exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
    echo "      awscli not found. Installing via apt..."
    apt-get update -qq
    apt-get install -y -qq awscli
fi

# -----------------------------------------------------------------------------
# Copy scripts
# -----------------------------------------------------------------------------
echo "[2/5] Installing scripts to ${INSTALL_DIR}..."

mkdir -p "$INSTALL_DIR"
cp "${SCRIPT_DIR}/postgres-to-r2.sh" "${INSTALL_DIR}/postgres-to-r2.sh"
cp "${SCRIPT_DIR}/restore-from-r2.sh" "${INSTALL_DIR}/restore-from-r2.sh"
chmod 750 "${INSTALL_DIR}/postgres-to-r2.sh" "${INSTALL_DIR}/restore-from-r2.sh"

# -----------------------------------------------------------------------------
# Env file template
# -----------------------------------------------------------------------------
echo "[3/5] Setting up env file at ${ENV_FILE}..."

if [[ -f "$ENV_FILE" ]]; then
    echo "      ${ENV_FILE} already exists. Leaving it alone."
else
    cp "${SCRIPT_DIR}/.env.example" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    echo "      Created ${ENV_FILE} from template. EDIT IT NOW with real R2 credentials."
fi

# -----------------------------------------------------------------------------
# Log file + logrotate
# -----------------------------------------------------------------------------
echo "[4/5] Setting up log file ${LOG_FILE}..."

touch "$LOG_FILE"
chmod 640 "$LOG_FILE"

cat >/etc/logrotate.d/hospeda-backup <<'EOF'
/var/log/hospeda-backup.log {
    weekly
    rotate 12
    compress
    delaycompress
    missingok
    notifempty
    create 640 root root
}
EOF

# -----------------------------------------------------------------------------
# Print cron instructions
# -----------------------------------------------------------------------------
echo "[5/5] Done."
echo ""
echo "============================================================"
echo " NEXT STEPS"
echo "============================================================"
echo ""
echo "1. Edit ${ENV_FILE} and fill in real R2 credentials:"
echo "   sudo nano ${ENV_FILE}"
echo ""
echo "2. Test the backup manually (FIRST RUN — verify upload works):"
echo "   sudo ${INSTALL_DIR}/postgres-to-r2.sh"
echo ""
echo "3. List the backup in R2 to confirm it landed:"
echo "   sudo ${INSTALL_DIR}/restore-from-r2.sh"
echo ""
echo "4. If the test passed, install the cron entry:"
echo "   sudo crontab -e"
echo ""
echo "   Then add the following line (03:00 Argentina = 06:00 UTC):"
echo ""
echo "   0 6 * * * /opt/hospeda-backup/postgres-to-r2.sh >> /var/log/hospeda-backup.log 2>&1"
echo ""
echo "============================================================"
