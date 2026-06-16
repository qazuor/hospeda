# Cron Management

Hospeda runs scheduled work in two distinct places. This guide is the
single source of truth for what runs where, how to inspect it, and how
to trigger jobs manually.

## Two layers of crons

| Layer | Scheduler | Where the job code lives | What it does |
|---|---|---|---|
| **In-process (API)** | `node-cron` inside the running api container | `apps/api/src/cron/jobs/` | Application logic: trial expiry, dunning, addon expiry, notification fan-out, search-index refresh, conversation cleanup, destination weather refresh, etc. |
| **VPS host** | system `cron` on the Vultr host | `scripts/backup/`, `scripts/server-tools/` | Operational maintenance: nightly Postgres backup, weekly app restart. |

Keep them separated mentally. In-process crons are part of the
**application**; if you redeploy the api you also redeploy the
schedules. Host crons are part of the **infrastructure**; they survive
container restarts and continue running even if the api is down.

---

## In-process crons (API)

### Inventory

The authoritative list lives in [`apps/api/src/cron/registry.ts`](../../apps/api/src/cron/registry.ts). As of the
last audit (2026-05-11) there are **16 jobs** registered. Each job is
defined as a `CronJobDefinition` in `apps/api/src/cron/jobs/<name>.ts`
with `name`, `schedule`, `description`, `enabled`, and a `handler`.

To get the current list at runtime, use:

```bash
hops cron-list
```

This hits `GET /api/v1/admin/cron` and prints a numbered table sorted
alphabetically by name. The index column is what `hops cron-trigger`
consumes.

### Manually triggering a job

```bash
# Interactive picker
hops cron-trigger

# By index from cron-list
hops cron-trigger 3

# By exact name
hops cron-trigger trial-expiry

# Dry-run (does not execute writes — depends on the job honouring the flag)
hops cron-trigger trial-expiry --dry-run

# Non-interactive (for wrapper scripts)
hops cron-trigger trial-expiry --dry-run --yes
```

The triggered run goes through the same `handler(jobContext)` code path
as the scheduled run, with `jobContext.dryRun` reflecting the flag.
Server-side timeout is 30s by default per job (`job.timeoutMs` in the
definition).

### Authentication

Both `cron-list` and `cron-trigger` need admin auth via the `Cookie:`
header. Set `HOPS_ADMIN_COOKIE` in `scripts/server-tools/.env.local`
with a Better Auth session token copied from browser DevTools — see
the [hops README](../../scripts/server-tools/README.md) for the full
recipe.

A planned long-lived bearer-token alternative is captured in
`SPEC-102` (admin-api-bearer-token); the cookie path is the only
option today.

### Enable / disable / reschedule

These operations are **not supported at runtime** today. To change
whether a job runs or its schedule:

1. Edit the job definition in `apps/api/src/cron/jobs/<name>.ts`.
2. Commit, push, redeploy the api (`hops redeploy api`).

A future runtime override mechanism (a `cron_schedule_overrides` table
plus an admin endpoint) is on the V2 backlog for the hops toolkit but
is not specced yet.

---

## VPS host crons

### Inventory

The host runs system `cron` under the `qazuor` user. Two recurring
jobs, plus any one-off entries. View the live list:

```bash
ssh -p 2222 qazuor@216.238.103.219
crontab -l
```

#### Daily Postgres backup

| Field | Value |
|---|---|
| Schedule | `0 6 * * *` (06:00 UTC = 03:00 ART daily) |
| Command | `/opt/hospeda-backup/postgres-to-r2.sh` |
| Log file | `/var/log/hospeda-backup.log` (rotated weekly, 12 weeks compressed) |
| Source | [`scripts/backup/postgres-to-r2.sh`](../../scripts/backup/postgres-to-r2.sh) |
| Output | `s3://hospeda-backups/hospeda-postgres-<TS>.dump` (`pg_dump -Fc`, ~400 KB compressed today) |
| Heartbeat | Better Stack — alerts if the ping is missed for 25h+ |
| Manual trigger | `hops db-backup-now` (writes to `manual/` prefix instead) |

See [`scripts/backup/README.md`](../../scripts/backup/README.md) for the
backup spec and [`docs/migration/disaster-recovery.md`](../migration/disaster-recovery.md)
scenario 5 for the recovery runbook when this stops running.

#### Weekly maintenance (restart + Docker prune)

| Field | Value |
|---|---|
| Schedule | `0 7 * * 0` (07:00 UTC Sunday = 04:00 ART Sunday, low traffic) |
| Command | `/home/qazuor/hospeda/scripts/server-tools/weekly-restart.sh` |
| Log file | `/var/log/hospeda-weekly-restart.log` |
| Source | [`scripts/server-tools/weekly-restart.sh`](../../scripts/server-tools/weekly-restart.sh) |
| What it does | (1) `hops app-restart api/web/admin --yes` sequentially with smoke between, only if backup ran < 28h ago. (2) `sudo docker system prune -f` to free build cache + dangling images + stopped containers + unused networks. |
| Heartbeat | Optional via `WEEKLY_RESTART_HEARTBEAT_URL` env |
| Manual trigger | Run the script directly: `~/hospeda/scripts/server-tools/weekly-restart.sh` |

The Docker prune step is **safe** by design: it only removes
dangling/unused resources, never running containers, named volumes
(databases), or tagged images currently in use. The reason it lives
inside the weekly cadence and not in a separate cron is operational
simplicity (one entry, one log file, one heartbeat) and because both
operations belong to the same maintenance window.

We learned the hard way (2026-05-11) that an unbounded build cache can
silently grow past 50 GB and starve the host of memory during the next
deploy — the cache layers reserve RAM in the daemon's index even when
disk has headroom. Pruning weekly keeps the cache in single-digit GB.

### Editing host crons

```bash
ssh -p 2222 qazuor@216.238.103.219
crontab -e
```

After saving, `cron` reloads automatically. Verify with `crontab -l`
and watch the next scheduled run via `sudo grep CRON /var/log/syslog`.

---

## Audit checklist — quarterly

Once per quarter (Jan / Apr / Jul / Oct), spend 15 minutes verifying
no cron has silently stopped working or fallen out of sync.

### In-process (API)

1. `hops cron-list` — confirm the table matches
   `apps/api/src/cron/registry.ts` (same names, same enabled flags).
2. For each enabled job, confirm `last_executed_at` (visible in api
   logs at boot and in Sentry breadcrumbs) is newer than its schedule
   would predict (e.g. `* */6 * * *` should have a run in the last 6h).
3. Spot-check one job with `hops cron-trigger <name> --dry-run` to
   confirm the manual trigger path still works.

### VPS host

1. SSH in, `crontab -l` — confirm the daily backup and weekly restart
   entries are both present and unchanged.
2. `ls -la /var/log/hospeda-backup.log` — confirm the mtime is within
   the last 24 hours.
3. `ls -la /var/log/hospeda-weekly-restart.log` — confirm the mtime is
   within the last 7 days (8 days is the soft tolerance accounting for
   timezone shifts).
4. `aws s3 ls s3://hospeda-backups/ --endpoint-url=...` — confirm at
   least one new daily backup object in the last 25 hours. (Or just
   `hops db-restore` to see the picker, then Ctrl+C without selecting.)

### Orphans (one-time check, then again every 6 months)

This used to be a real risk because previous hosting (Vercel + QStash)
had its own scheduled-job system. After the VPS migration completed
(Phase 16.4), every cron was supposed to live on the VPS. Verify
nothing got left behind:

1. **Vercel scheduled functions** — there should be none. Open the
   Vercel project (if the project still exists), navigate to Cron
   Jobs, confirm the list is empty. Phase 16.4 deleted the Vercel
   project entirely, so this should not even be reachable.
2. **QStash schedules** — open the Upstash console (if the QStash
   resource still exists). Confirm zero active schedules. Phase 16.4
   deleted the Upstash resource.
3. **GitHub Actions schedules** — `git grep -nE "schedule:|cron:" .github/`
   in the repo. Anything that triggers external API calls on a
   schedule is a candidate for migration to a host cron + hops command.

If you find an orphan, file an issue and either move it to the host
cron + a hops command (preferred for ops alignment) or to the API
in-process cron registry (preferred for application-level work).

---

## Adding a new cron

### In-process (recommended for application logic)

1. Create `apps/api/src/cron/jobs/<name>.ts` with a `CronJobDefinition`.
2. Add it to the `cronJobs` array in `apps/api/src/cron/registry.ts`.
3. Add tests in `apps/api/test/cron/jobs/<name>.test.ts`.
4. Commit, push, redeploy the api. The job auto-registers at boot.
5. Verify with `hops cron-list` that it appears.
6. Trigger once with `hops cron-trigger <name> --dry-run` to validate.

### VPS host (recommended for ops / infra)

1. Add the script to `scripts/server-tools/<name>.sh` (or `scripts/`
   if it is a one-off not part of the toolkit).
2. Make it idempotent and safe to run twice in a row.
3. Test it manually on the VPS first. Confirm it logs to a file under
   `/var/log/hospeda-*.log` and exits with a meaningful status code.
4. Add the crontab entry on the VPS (`crontab -e`), pipe stdout/stderr
   to its log file.
5. Update this document's "Inventory" section.
6. Add a Better Stack heartbeat monitor if the job runs less often than
   daily — without it, a silent failure goes undetected for too long.

---

## Reference

+ [hops toolkit README](../../scripts/server-tools/README.md)
+ [Disaster recovery playbook](../migration/disaster-recovery.md) —
  scenario 5 covers backup chain failure
+ [VPS deployment spec](../migration/vps-deployment-spec.md) Paso 17.4
  for the original audit requirement
+ [In-process cron registry](../../apps/api/src/cron/registry.ts)
+ [Backup script](../../scripts/backup/postgres-to-r2.sh)
+ [Weekly restart script](../../scripts/server-tools/weekly-restart.sh)
