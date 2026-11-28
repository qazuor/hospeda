# Umami Operations

Runbook for the self-hosted Umami instances that replaced PostHog (HOS-2119).
For what Umami tracks and how the dashboards are built, see
[`docs/analytics/umami-dashboards.md`](../analytics/umami-dashboards.md).

## Instances

| Environment | URL | Postgres container | Coolify |
|---|---|---|---|
| Production | `https://pulso.hospeda.com.ar` | `postgresql-qymlg13mxm2wnbfifzclx1el` | Umami prod service |
| Staging | the `HOSPEDA_UMAMI_URL` of `hospeda-api-staging` | `postgresql-z9pg0jelozkdwrsxpitepvxl` | Umami staging service |

Container names are assigned by Coolify. If a service is recreated they change,
and the backup env files below must be updated to match
(`docker ps --format '{{.Names}}' | grep postgresql`).

## Applying dashboards, segments, cohorts and the recorder config

`pnpm umami:setup` is idempotent and never deletes anything. Full behavior is in
[`umami-dashboards.md`](../analytics/umami-dashboards.md#creating-and-updating-them).

Run it from any checkout that is up to date with `origin/staging`, staging first,
then production:

```bash
HOSPEDA_UMAMI_URL=https://pulso.hospeda.com.ar \
HOSPEDA_UMAMI_WEBSITE_ID_WEB=<WEB website id> \
UMAMI_SETUP_API_KEY=<read-write umami_... key> \
pnpm umami:setup --dry-run   # then again without --dry-run
```

- The production WEB website id is the `PUBLIC_UMAMI_WEBSITE_ID` of `hospeda-web-prod`.
- The API key must belong to a user with write access to the website. Create it in
  Umami → Settings → API keys, and do not reuse the view-only
  `HOSPEDA_UMAMI_API_KEY` of the API app.
- Prefer reading the key with `read -rs UMAMI_SETUP_API_KEY; export UMAMI_SETUP_API_KEY`
  so it does not land in shell history.
- A second real run must report every resource as `unchanged`.
- The run also writes the WEB website's recorder config (session replay and
  heatmaps, see [`session-replay-privacy.md`](../analytics/session-replay-privacy.md)).
  Review the `recorder updated` diff of the dry run before applying.

## Write key for QR campaign segments

The admin QR campaigns panel creates `QR · <campaign>` segments on the WEB website
(see [`umami-dashboards.md`](../analytics/umami-dashboards.md#qr-campaign-segments-hos-2679)).
The API needs its own key for that, `HOSPEDA_UMAMI_WRITE_API_KEY`:

1. Log in to Umami as a user with **edit** access to the WEB website (a team member
   or the website owner). A view-only user's key answers 401 when creating.
2. Umami → Settings → API keys → create a key (format `umami_...`).
3. Set it on the API app of each environment and redeploy (owner approval needed):
   `hops env-set api HOSPEDA_UMAMI_WRITE_API_KEY --secret`, then `hops redeploy api`.
   An `app-restart` does not pick up a new variable.

Never reuse `HOSPEDA_UMAMI_API_KEY` (it must stay view-only) or the
`UMAMI_SETUP_API_KEY` of `pnpm umami:setup` (script-only). The API uses this key
only for `POST /api/websites/:id/segments` and the matching list; a guard test
(`apps/api/test/guards/no-umami-write-credential.guard.test.ts`) keeps it confined to
one service. If Umami refuses the key, the admin shows «Umami rechazó la clave de
escritura» (`UMAMI_KEY_REJECTED`): replace it with a key of a user that can edit.

## Backups

Each Umami database is dumped daily to the R2 bucket `hospeda-umami-backups`,
separate from the Hospeda platform backups. The dump uses the same script
(`scripts/backup/postgres-to-r2.sh`, installed at `/opt/hospeda-backup/`),
pointed at a per-instance env file through `HOSPEDA_BACKUP_ENV_FILE`.

| Instance | Env file | R2 prefix | Cron (root, UTC) | Log |
|---|---|---|---|---|
| Production | `/etc/hospeda-backup-umami-prod.env` | `prod/` | `40 9 * * *` | `/var/log/hospeda-backup-umami-prod.log` |
| Staging | `/etc/hospeda-backup-umami-staging.env` | `staging/` | `50 9 * * *` | `/var/log/hospeda-backup-umami-staging.log` |

The cron line is:

```
40 9 * * * HOSPEDA_BACKUP_ENV_FILE=/etc/hospeda-backup-umami-prod.env /opt/hospeda-backup/postgres-to-r2.sh >> /var/log/hospeda-backup-umami-prod.log 2>&1
```

### Env file

Mode `600`, owned by root. `R2_ACCOUNT_ID` and `BACKUP_PASSPHRASE` are the same as
in `/etc/hospeda-backup.env`; the R2 key is a separate token scoped only to
`hospeda-umami-backups`.

```bash
R2_ACCOUNT_ID=<same as /etc/hospeda-backup.env>
R2_ACCESS_KEY_ID=<hospeda-umami-backups token>
R2_SECRET_ACCESS_KEY=<hospeda-umami-backups token>
R2_BUCKET=hospeda-umami-backups/prod        # the prefix rides in the bucket value
POSTGRES_CONTAINER=postgresql-qymlg13mxm2wnbfifzclx1el
POSTGRES_USER=<docker exec <container> printenv POSTGRES_USER>
POSTGRES_DB=umami
BACKUP_DIR=/var/tmp/hospeda-backups-umami-prod
MIN_BACKUP_SIZE=5000                         # staging: 200000
BACKUP_PASSPHRASE='<same as /etc/hospeda-backup.env>'
```

`MIN_BACKUP_SIZE` is compared against the **encrypted** file, and GPG compresses
the dump: the first production backup was 73 KB raw and 13.8 KB encrypted. Raise
the threshold as the databases grow, so an empty dump keeps failing.

### Manual backup

Run one before any upgrade or risky change:

```bash
sudo HOSPEDA_BACKUP_ENV_FILE=/etc/hospeda-backup-umami-prod.env /opt/hospeda-backup/postgres-to-r2.sh
```

### Restore drill

`scripts/backup/umami-restore-drill.sh` downloads the latest object of each
prefix, decrypts it, restores it into a throwaway `postgres:16-alpine` container
(never the live ones), and compares table and row counts against the live
database. It removes the container and the downloaded files on exit.

```bash
scp -P 2222 scripts/backup/umami-restore-drill.sh qazuor@<vps-ip>:~/
ssh -p 2222 qazuor@<vps-ip> 'sudo bash ~/umami-restore-drill.sh'
```

It prints `DRILL OK` when both restores have the same table count as live. Row
counts on `session` and `website_event` can be slightly higher live, since
traffic keeps arriving after the dump. Run it once a quarter and after changing
the env files.

### Real restore

1. Stop the Umami app service in Coolify (leave its Postgres running).
2. Download and decrypt the chosen backup:

   ```bash
   sudo bash -c 'source /etc/hospeda-backup-umami-prod.env
     export AWS_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY
     EP=https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com
     aws s3 ls s3://$R2_BUCKET/ --endpoint-url $EP
     aws s3 cp s3://$R2_BUCKET/<file>.dump.gpg /var/tmp/umami.dump.gpg --endpoint-url $EP
     gpg --batch --passphrase "$BACKUP_PASSPHRASE" -d /var/tmp/umami.dump.gpg > /var/tmp/umami.dump'
   ```

3. Restore it over the live database:

   ```bash
   sudo bash -c 'docker exec -i postgresql-qymlg13mxm2wnbfifzclx1el \
     pg_restore -U <POSTGRES_USER> -d umami --clean --if-exists --no-owner --no-privileges \
     < /var/tmp/umami.dump'
   ```

4. Start the Umami app service and check the dashboard loads.
5. Delete `/var/tmp/umami.dump*`.

## Disk

Event data grows with traffic. Check it monthly:

```bash
docker exec postgresql-qymlg13mxm2wnbfifzclx1el \
  psql -U <POSTGRES_USER> -d umami -c "select pg_size_pretty(pg_database_size('umami'))"
df -h /
```

Retention of old event data is not configured yet. Deleting old rows from
`website_event` or `session_replay` is a manual, owner-approved operation, with
a manual backup first.

## Upgrades

1. Read the Umami release notes for the target version, especially database
   migrations.
2. Take a manual backup (above).
3. Upgrade staging first: change the image tag in its Coolify service and redeploy.
   Coordinate the redeploy with the owner.
4. Check the staging dashboard loads, a pageview arrives, and `pnpm umami:setup --dry-run`
   reports everything `unchanged`.
5. Repeat for production.
