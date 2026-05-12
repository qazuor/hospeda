# Hospeda PostgreSQL Backups → Cloudflare R2

Daily off-site backups of the Hospeda production Postgres database, stored in
Cloudflare R2 with zero egress fees.

## Files

| File | Purpose |
|------|---------|
| `postgres-to-r2.sh` | Cron-driven backup script. Runs `pg_dump` inside the Postgres container, uploads the dump to R2, deletes local copy. |
| `restore-from-r2.sh` | Manual restore script. Lists available backups, downloads the chosen one, and runs `pg_restore` after explicit confirmation. |
| `.env.example` | Template for `/etc/hospeda-backup.env`. |
| `install-on-vps.sh` | One-shot installer for the VPS. Copies scripts to `/opt/hospeda-backup`, sets up logrotate, and prints next-step instructions. |

## Backup format

- `pg_dump -Fc` (custom format with built-in zlib compression).
- `--no-owner --no-privileges` so dumps are portable across Postgres instances.
- Filename: `hospeda-postgres-YYYY-MM-DD_HHMMSSZ.dump` (UTC timestamp).
- A real Hospeda backup with seeded data is in the **2-5 MB** range. Smaller
  than `MIN_BACKUP_SIZE` (default 100 KB) is treated as failure and not
  uploaded.

## R2 cost

R2 free tier: **10 GB storage**, **1M Class A ops/month**, **10M Class B
ops/month**, and **egress is always free**. Daily 2 MB backups with 30-day
retention sit at ~60 MB total — well under the free tier.

See `docs/migration/vps-deployment-spec.md` (Fase 13) for the full cost
analysis and projection at scale.

## Installation on the VPS

From the repo root, copy this directory to the VPS and run the installer:

```bash
# Local machine
scp -P 2222 -r scripts/backup qazuor@<vps-ip>:/tmp/hospeda-backup-install

# On the VPS
ssh -p 2222 qazuor@<vps-ip>
sudo /tmp/hospeda-backup-install/install-on-vps.sh
```

The installer:

1. Verifies `docker` is present and installs `awscli` if missing.
2. Copies the scripts to `/opt/hospeda-backup/` (mode 750).
3. Creates `/etc/hospeda-backup.env` from the template (mode 600).
4. Sets up `/var/log/hospeda-backup.log` with a weekly logrotate config (12
   weeks of compressed history).
5. Prints the cron line to add manually via `sudo crontab -e`.

After running it, edit `/etc/hospeda-backup.env` with the real R2 credentials,
then run a manual test:

```bash
sudo /opt/hospeda-backup/postgres-to-r2.sh
sudo /opt/hospeda-backup/restore-from-r2.sh   # list-only, no args, just confirms upload
```

If both succeed, install the cron entry:

```bash
sudo crontab -e
# Add:
0 6 * * * /opt/hospeda-backup/postgres-to-r2.sh >> /var/log/hospeda-backup.log 2>&1
```

`0 6 * * *` runs daily at 06:00 UTC, which is 03:00 in Argentina (UTC-3, no DST).

## Restoring a backup

On the VPS:

```bash
# 1. List available backups
sudo /opt/hospeda-backup/restore-from-r2.sh

# 2. Restore a specific backup (asks for "YES" confirmation, then drops and
#    recreates all objects in the target database).
sudo /opt/hospeda-backup/restore-from-r2.sh hospeda-postgres-2026-05-07_060000Z.dump

# 3. (Optional) Restore into a non-default database for verification:
sudo /opt/hospeda-backup/restore-from-r2.sh hospeda-postgres-2026-05-07_060000Z.dump postgres_restore_test
```

After restore, restart the API container in Coolify so it reconnects with the
new state (`hospeda-api-prod` → Restart).

## Monitoring

Log location: `/var/log/hospeda-backup.log`. Rotated weekly, 12 weeks of
history compressed.

Recommended manual smoke check **once a quarter**: download the latest backup
to a workstation and verify it `pg_restore`s cleanly into a throwaway
database. Untested backups are not backups.

## Configuration reference

All variables read from `/etc/hospeda-backup.env`:

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `R2_ACCOUNT_ID` | yes | — | Cloudflare account ID, used to build the R2 endpoint URL. |
| `R2_ACCESS_KEY_ID` | yes | — | R2 API token access key, scoped to the bucket. |
| `R2_SECRET_ACCESS_KEY` | yes | — | R2 API token secret. |
| `R2_BUCKET` | yes | `hospeda-backups` | Bucket name. Must already exist. |
| `POSTGRES_CONTAINER` | yes | — | Coolify-assigned container name for the Postgres resource. |
| `POSTGRES_USER` | yes | `postgres` | Postgres role used for the dump. |
| `POSTGRES_DB` | yes | `postgres` | Database to back up. |
| `BACKUP_DIR` | no | `/var/tmp/hospeda-backups` | Local staging directory before upload. |
| `MIN_BACKUP_SIZE` | no | `100000` | Minimum dump size in bytes. Below this the script aborts before uploading. |
