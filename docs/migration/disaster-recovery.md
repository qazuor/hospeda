# Hospeda — Disaster Recovery Playbook

> Runbooks for the four most likely failure modes that cause production
> downtime. Print this page or keep it open in another tab the moment
> you suspect something is broken — every minute spent looking up
> commands during an incident is downtime you do not get back.

## Scope

| Field | Value |
|---|---|
| Production stack | Vultr VPS (Coolify v4 + Docker) at `216.238.103.219` SSH `:2222` |
| Database | Postgres 17 in Coolify-managed container, 24h R2 backup chain |
| Domains | `hospeda.com.ar`, `api.hospeda.com.ar`, `admin.hospeda.com.ar` (Cloudflare proxied) |
| RTO target | **< 1 hour** for prod (any subdomain returning 5xx counts as down) |
| RPO target | **24 hours** (latest daily backup at 03:00 ART) |
| Owner on call | `qazuor@gmail.com` (single operator today) |

## Detection — how you know something broke

| Signal | Source | What it implies |
|---|---|---|
| 4+ monitors red simultaneously | Better Stack | VPS-level outage (scenario 1) |
| 1 monitor red, others green | Better Stack | Single-app outage (scenario 4) |
| `Cannot connect to database` in api logs | Sentry, `hops logs api` | Postgres broken (scenario 2 or container restart loop) |
| Coolify UI returns 502 / unreachable but apps still serve | Browser to `coolify.hospeda.com.ar` | Coolify-only outage (scenario 3) |
| Daily backup heartbeat missed > 25h | Better Stack heartbeat alert | Backup chain broken — see scenario 5 |
| User reports "site is slow" or "I cannot log in" | Discord, contact form | Verify against monitors before assuming it is real |

Before reaching for any runbook, **always**:

1. Confirm the Better Stack dashboard at `betterstack.com/uptime` to see which exact monitors are red.
2. Check Sentry at `sentry.io/.../hospeda` for the last 30 minutes of errors.
3. Try to SSH to the VPS — `ssh -p 2222 qazuor@216.238.103.219`. If SSH responds, the host is alive even if Coolify is not.
4. Open `https://hospeda.com.ar` and `https://api.hospeda.com.ar/api/v1/health/` in your browser.

These four checks take under 2 minutes and tell you which scenario you are in.

---

## Scenario 1 — VPS completely down

**Symptoms:**

- Every Better Stack monitor red at the same minute.
- SSH to `216.238.103.219:2222` times out or returns `connection refused`.
- The Vultr dashboard at `my.vultr.com` shows the instance as `stopped`, `failed`, or `migrating`.

**Cause taxonomy** (you do not need to diagnose first — start the runbook below in parallel with diagnosis):

- Vultr hardware failure / host migration.
- DDoS or sustained traffic spike that exhausted resources before the OOM killer recovered.
- SSH lockout from a misconfigured firewall change (`ufw deny 2222` etc.).
- Disk full on `/`.

### Recovery steps

The recovery target is "serve traffic from a fresh VPS with the latest backup restored". Estimated wall-clock 45-75 min if everything goes well.

1. **Communicate.** Post a one-line "investigating intermittent issues" note to Discord / Twitter. Do not promise an ETA yet.
2. **Open the Vultr dashboard.** If the instance shows `stopped`, click `Start` and wait 2 minutes — many "down" events are just a hypervisor reboot.
3. **If start does not recover within 5 minutes**, take a snapshot of the broken instance (`Settings` → `Snapshots` → `Take Snapshot`). This preserves any in-flight data for postmortem.
4. **Provision a replacement VPS.** Same plan (Vultr HF $24/mo, 2 vCPU 4 GB), same region (São Paulo / `sao`), same OS (Ubuntu 24.04 LTS). Note the new IP.
5. **SSH key.** Add your existing SSH key during provisioning. Boot completes in 2-4 min.
6. **Run the standard hardening sequence** from `docs/migration/vps-deployment-spec.md` Pasos 3.1 → 3.9. This is `~15` minutes if you scripted them; manual it is `~25` minutes.
7. **Install Coolify** from Paso 4.1: `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash`.
8. **Restore Coolify configuration.** Two paths:
   - **Fast path (recommended):** From the snapshot taken in step 3, scp `/data/coolify/source/.env` and `/data/coolify/proxy/dynamic/` over to the new VPS. This restores the Coolify admin account, projects, app definitions, and Traefik routes without re-clicking the wizard.
   - **Slow path:** Re-create the Coolify admin account, re-link the GitHub source, re-create the Postgres / Redis / api / web / admin resources by hand. Allow `~25` minutes.
9. **Trigger initial deploys** from Coolify UI for `hospeda-postgres`, `hospeda-redis`, `hospeda-api-prod`, `hospeda-web-prod`, `hospeda-admin-prod`. Wait for each to go green (`~5-10` minutes per app on first deploy).
10. **Restore the database.** From the new VPS, install hops (`scripts/server-tools/install.sh`) and run:

    ```bash
    hops db-restore  # picker shows the daily/manual chain newest-first
    # pick the most recent daily backup, confirm yes
    ```

    The pre-restore snapshot will fail (target DB just got created, nothing to dump) — pass `--no-snapshot-first` for the first restore on a fresh VPS.
11. **Verify the data is there.** `hops db-counts`. Compare against the engram observation `vps-migration/db-baseline-row-counts` (or just check that `users`, `accommodations`, `destinations`, `posts` all have non-zero rows).
12. **Restart all apps so they reconnect to the restored DB:**

    ```bash
    hops app-restart api
    hops app-restart web
    hops app-restart admin
    ```

13. **Cut DNS to the new IP.** Cloudflare → DNS → A record for `hospeda.com.ar` → change to new VPS IP, **proxy ON (orange cloud)**. Repeat for `api.hospeda.com.ar`, `admin.hospeda.com.ar`, `coolify.hospeda.com.ar`. Save.
14. **Wait for DNS propagation.** 2-5 min if Cloudflare proxy is on. Validate with `dig hospeda.com.ar` from your laptop.
15. **Smoke the full stack:**

    ```bash
    hops health prod
    curl -fsS https://hospeda.com.ar > /dev/null && echo OK
    curl -fsS https://api.hospeda.com.ar/api/v1/health/ | head -c 200
    ```

16. **Communicate resolution.** "Service restored, root cause under investigation."
17. **Postmortem within 48h.** What broke, why was the recovery slower than RTO if it was, what would prevent it.

### Verification — done when

- All Better Stack monitors green for 15 consecutive minutes.
- A real user (you) can log in via `admin.hospeda.com.ar` and read at least one row that was not in the seed.
- Sentry shows no new errors in the 10 minutes after recovery.

### Rollback — what if recovery itself fails

Recovery cannot really be "rolled back" — once DNS cuts to the new VPS, the old VPS no longer matters. If the new VPS does not stabilize within 90 min:

- Switch DNS back to the old IP (if the Vultr dashboard now reports it as `running` again — sometimes hardware events resolve while you provision the replacement).
- If the old VPS is permanently dead, **stop the recovery and call for help** rather than thrashing. The data is safe in R2; restoring to a different cloud (Hetzner, DigitalOcean) is fine but takes longer than 1h. Communicate honestly: "Working through extended outage, ETA 4-6h."

---

## Scenario 2 — Postgres corrupt or wiped, VPS OK

**Symptoms:**

- VPS is reachable via SSH, Coolify UI loads.
- API returns 5xx for every read endpoint.
- `hops logs api -n 100` shows `relation "..." does not exist` or `permission denied for table` or `database "postgres" does not exist`.
- `hops db-counts` returns zero rows everywhere or fails to connect.
- Web / admin pages render but are empty or show error states.

**Cause taxonomy:**

- A bad migration ran (`drizzle-kit push` against prod with a destructive change).
- An operator typed a `DROP` against the wrong DB.
- Postgres data volume mounted to wrong path after a Coolify upgrade.
- Disk full caused Postgres to corrupt WAL.

### Recovery steps

The data is in R2. The runbook is: take a "current state" snapshot first (paranoia — even bad state is better than no state for postmortem), then restore the latest known-good backup.

Estimated wall-clock 15-30 min.

1. **Communicate.** "Investigating data layer issue, no expected impact to existing browse traffic." (Cache-served pages may still work for a few minutes.)
2. **Capture current state.** Even if the DB is broken, take a snapshot of whatever is left:

    ```bash
    hops db-backup-now --yes
    # → uploads to manual/hospeda-postgres-<TS>.dump
    ```

    If `db-backup-now` fails because pg_dump cannot read the schema, skip this step and rely on the Coolify volume snapshot if available. Note in the postmortem that "current state" was unrecoverable.
3. **List backups newest-first:**

    ```bash
    hops db-restore   # picker opens, do NOT confirm yet
    ```

    The newest entry is usually the daily from `~03:00 ART`. The one BEFORE the manual you just took (if step 2 worked) is the last "real" state from the cron.
4. **Pick the latest known-good daily backup**, type `yes` to confirm.
   - The pre-restore snapshot uploads automatically (default behavior).
   - Download → docker cp → pg_restore runs.
   - Expected duration: 30-90 seconds for a < 5 MB backup.
5. **Restart the api so it reconnects:**

    ```bash
    hops app-restart api
    ```

6. **Verify:**

    ```bash
    hops db-counts
    # row counts should match engram baseline
    curl -fsS https://api.hospeda.com.ar/api/v1/health/ | head -c 200
    # should return { "status": "ok", ... }
    ```

7. **Smoke a real flow.** Open `https://hospeda.com.ar`, click into a destination, click into an accommodation. Confirm data renders.
8. **Communicate resolution.** "Data layer restored from latest daily backup. Estimated data loss: up to 24 hours." (Be honest about the RPO.)
9. **Postmortem.** If a migration caused this, add an integration test that reproduces the destructive change. If a typo caused it, document the lesson and consider adding a `--target-db` requirement to any prod psql session.

### Verification — done when

- `hops db-counts` matches expected baseline.
- One read flow + one write flow both succeed end-to-end (e.g. browse a destination + submit the contact form).
- Sentry shows no new DB-related errors for 10 consecutive minutes.

### Rollback — what if the chosen backup is also broken

The pre-restore snapshot from step 4 is your safety net. To roll back:

```bash
hops db-restore   # pick `manual/pre-restore-<TS>.dump`
```

If THAT also fails to bring the DB to a working state, walk further back through the daily chain. R2 retains the last `~30` daily backups. Lose one day at a time until you find a clean one.

---

## Scenario 3 — Coolify down, apps still serving

**Symptoms:**

- `https://coolify.hospeda.com.ar` returns 502 / Bad Gateway / unreachable.
- `https://hospeda.com.ar`, `https://api...` still respond 200 (Better Stack monitors stay green).
- SSH to the VPS works.
- `docker ps` on the VPS shows `coolify`, `coolify-db`, `coolify-redis`, `coolify-realtime` containers in `Restarting (1)` or `Exited (1)` state.

**Cause taxonomy:**

- Coolify upgrade failed mid-rollout.
- `coolify-db` (the orchestrator's own Postgres, NOT our prod DB) corrupted.
- Disk full on `/` caused Coolify volumes to error.

This scenario is **not user-visible** as long as the app containers stay healthy, but you cannot deploy or change anything until Coolify recovers. Treat it as a P2.

### Recovery steps

Estimated 10-30 min depending on whether Coolify needs a reinstall.

1. **Confirm apps are healthy.** Run `hops health prod`. Run `curl -fsS https://hospeda.com.ar`. Verify all three apps (`hops free-mem`).
2. **Check Coolify logs.** `docker logs coolify --tail 200`. Look for the actual error.
3. **Try the quick fix first:**

    ```bash
    docker restart coolify coolify-db coolify-redis coolify-realtime
    sleep 30
    curl -fsS https://coolify.hospeda.com.ar | head -c 200
    ```

    Most Coolify hangs are recoverable by a restart of its own stack.
4. **If restart loops continue**, check disk usage:

    ```bash
    df -h /
    docker system df
    ```

    If `/` is > 90% full, prune unused docker resources (do NOT use `--volumes` or you might lose the prod DB volume):

    ```bash
    docker system prune -a   # safe — does not touch volumes
    docker image prune -a
    ```

5. **If Coolify still does not recover**, reinstall Coolify (the data lives in `/data/coolify/`, which the installer preserves):

    ```bash
    curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
    ```

    The installer detects the existing install and offers an "upgrade" path. Existing app definitions, env vars, and resource configs are preserved.
6. **Wait for the wizard to come back**, log in, verify the resource list still has `hospeda-postgres`, `hospeda-redis`, `hospeda-api-prod`, `hospeda-web-prod`, `hospeda-admin-prod`.

### Verification — done when

- `https://coolify.hospeda.com.ar` returns the dashboard.
- All five resources show `Running` in green.
- A test deploy works (push a no-op commit on `staging-test` branch and trigger redeploy of the api app — should succeed).

### Rollback — what if Coolify is permanently broken

Apps keep running indefinitely without Coolify (Docker daemon does the actual work; Coolify is only orchestration UI + Traefik config). For weeks if needed.

If reinstall fails and you cannot recover Coolify, the workaround is:

- Manage containers via raw `docker` commands (`hops` already wraps most of what you need: `hops app-restart`, `hops logs`, `hops db-counts`, `hops db-restore`).
- Push code via standard `git push`, then `docker pull` + `docker stop` + `docker run` manually per app. Tedious but possible.
- Plan to replace Coolify with a fresh install or migrate to a different orchestrator (Dokploy, Caprover) on a fresh VPS — see scenario 1 runbook.

---

## Scenario 4 — Single app in crash loop

**Symptoms:**

- One Better Stack monitor red, the other two green.
- `hops logs <kind> -n 200` shows an error trace repeating every few seconds (process exits, Docker restarts, exits again).
- `hops free-mem` shows the container restart count incrementing.

**Cause taxonomy:**

- A bad deploy (env var missing, code bug, dependency upgrade incompatibility).
- Postgres or Redis became unreachable for that one app due to a network issue (rare in single-host Docker).
- Memory limit exhausted (also rare with the current 4 GB VPS unless you bumped a workload).

### Recovery steps

Estimated 5-15 min.

1. **Identify which app.** Better Stack tells you. Confirm with:

    ```bash
    hops health prod
    ```

2. **Look at the last 200 log lines** for the affected app:

    ```bash
    hops logs api -n 200    # or web / admin
    ```

    Find the FIRST error trace, not the last. The last is usually a downstream effect; the first is the cause.
3. **Decide between two paths:**
    - **Path A — Rollback** if the failure correlates with a recent deploy (last commit is in the timeline of when monitors went red). Use Coolify UI → app → Deployments → previous green deploy → `Redeploy`. Zero-touch, 2-5 min.
    - **Path B — Fix forward** if the failure is from an env var / config drift, not from code. Either:
      - Fix env via `hops env-set <kind> KEY VALUE` then `hops redeploy <kind>`.
      - OR push a fix commit (small one-line correction) on the prod branch.
4. **Watch the first 60 seconds after restart.** If it crashes again with the same error, you guessed wrong on the cause — go back to step 2.
5. **Once stable**, run `hops health prod` to confirm all three apps green.

### Verification — done when

- The previously-failing app's Better Stack monitor is green for 10 consecutive minutes.
- `hops free-mem` shows restart count stopped incrementing.
- Sentry shows no new error spikes from the affected app.

### Rollback — what if neither rollback nor fix-forward work

Two more aggressive options:

- **Mark the app as down** in Better Stack to silence alerts while you debug. Communicate to users that "X feature is temporarily unavailable" if the app is user-facing.
- **Restore the last known-good deploy from Coolify** — even older than what the UI lists if you have the commit SHA in git log. `git push origin <sha>:main --force` then redeploy.

If after 90 min the app still does not stabilize, treat it as a Scenario 1-grade incident — rebuild the entire stack on a fresh VPS to rule out platform-level issues.

---

## Scenario 5 — Backup chain broken, no recent backup

**Symptoms:**

- Better Stack heartbeat for `BACKUP_HEARTBEAT_URL` did not ping in > 25 hours (you should get an email alert).
- `hops db-restore` shows the latest backup is older than 24 hours.

**Cause taxonomy:**

- Cron entry was removed by mistake (`sudo crontab -e` typo).
- R2 credentials rotated and `/etc/hospeda-backup.env` was not updated.
- Disk full on `/var/tmp` so pg_dump could not stage the file.
- Postgres container was renamed (Coolify redeploy changed the UUID-suffixed container name) and the bash script's hard-coded `POSTGRES_CONTAINER` env var is stale.

This is **not** an outage by itself — the database is fine. It IS a critical hardening incident because the moment scenario 2 happens you have no fallback.

### Recovery steps

Estimated 5-20 min.

1. **Trigger a manual backup right now:**

    ```bash
    hops db-backup-now --yes
    ```

    If that succeeds, the immediate exposure is closed.
2. **Diagnose why the cron stopped:**

    ```bash
    sudo crontab -l                    # is the entry still there?
    sudo grep CRON /var/log/syslog | tail -50   # last cron runs
    sudo cat /var/log/hospeda-backup.log | tail -100   # backup script's own log
    ```

3. **Common fixes:**
    - **Cron missing**: `sudo crontab -e`, re-add `0 6 * * * /opt/hospeda-backup/postgres-to-r2.sh >> /var/log/hospeda-backup.log 2>&1`.
    - **R2 creds rotated**: `sudo $EDITOR /etc/hospeda-backup.env`, update `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`, `chmod 600 /etc/hospeda-backup.env`. Run a manual test: `sudo /opt/hospeda-backup/postgres-to-r2.sh`.
    - **Disk full**: `df -h /var/tmp`. Free space (`docker system prune -a` if needed). Re-run.
    - **Container name drift**: `hops find postgres` to get the current container name. Update `POSTGRES_CONTAINER` in `/etc/hospeda-backup.env`. The `hops` toolkit resolves containers by label so this is only a problem for the bash daily.
4. **Verify the fix runs end-to-end** by triggering the bash script manually:

    ```bash
    sudo /opt/hospeda-backup/postgres-to-r2.sh
    # tail the output, confirm "Backup completed successfully"
    ```

5. **Wait until 03:00 ART tomorrow** and verify the heartbeat pings as expected.

### Verification — done when

- A fresh manual backup is in `s3://hospeda-backups/manual/`.
- The cron entry is in `crontab -l`.
- The backup script runs without error from the command line.
- Better Stack heartbeat alert is acknowledged and reset.

---

## Quarterly playbook test

Untested runbooks are not runbooks — they are wishful thinking. Schedule a tabletop exercise once per quarter (Jan / Apr / Jul / Oct). Pick one scenario at random, follow the runbook step by step against a throwaway environment, and time yourself.

Acceptable outcomes:

- You complete the runbook and meet the RTO target. Update the runbook with any small drift you noticed.
- You complete the runbook but miss RTO. File an issue: "scenario X recovery took 90 min, target 60 min, fix is to <pre-stage / cache / parallelize>".
- You cannot complete the runbook. Stop, fix the gap, then test again.

For scenario 2 specifically, you can test for real **without** affecting prod by using `hops db-restore --target-db postgres_restore_test` — restores into a non-prod database so the only side effect is some R2 read traffic.

---

## Communications template

The communication step in every scenario above is more important than the technical recovery in terms of user trust. Use these templates and edit the brackets:

**Initial (within 5 min of detection):**
> "We're investigating an issue affecting [feature / site]. Updates here every 15 min."

**Mid-incident (every 15 min):**
> "Still investigating. [Brief honest status: 'cause identified, working on fix' / 'still diagnosing' / 'fix in progress, ETA X min']."

**Resolution:**
> "Service restored at [time]. [One-line cause if known: 'database temporarily unavailable' / 'a deploy introduced a regression']. Full postmortem to follow."

**Postmortem (within 48h):**
> Title: "Postmortem — [scenario] on [date]"
> Sections: Timeline · Impact · Root cause · Recovery actions · What went well · What went poorly · Action items.

---

## Reference — what hops can do during an incident

| Need | hops command | Notes |
|---|---|---|
| Are the apps up? | `hops health prod` | Wraps `scripts/smoke-test.sh`. |
| Tail logs | `hops logs api -n 200` | `-f` to follow, `-g` to grep. |
| Memory pressure | `hops free-mem` | Host + per-container. |
| DB row counts | `hops db-counts` | Approximate via pg_stat_user_tables. |
| Take a backup right now | `hops db-backup-now --yes` | Goes to `manual/` prefix on R2. |
| Restore from R2 | `hops db-restore` | Picker, pre-restore snapshot is automatic. |
| Restart a single app | `hops app-restart <kind>` | No full Coolify redeploy. |
| Trigger a Coolify redeploy | `hops redeploy <kind>` | Full rebuild. |
| Inspect Coolify env var | `hops env-list <kind>` | `--reveal` to see values. |
| Edit a Coolify env var | `hops env-set <kind> KEY VALUE` | Needs `hops redeploy` to take effect. |
| Run psql one-off | `hops psql 'SELECT ...'` | Or `hops psql` for interactive shell. |
| Find a container by kind | `hops find postgres` | Returns the current Coolify-assigned name. |
| List in-process crons | `hops cron-list` | Needs `HOPS_ADMIN_COOKIE`. |
| Trigger a cron | `hops cron-trigger <N or name>` | `--dry-run` for safe test. |

Full reference: `scripts/server-tools/README.md`.

---

## Reference — external dashboards

| What | URL | When to open |
|---|---|---|
| Vultr instance dashboard | `my.vultr.com` | Scenario 1 (VPS state, snapshots, resize) |
| Coolify panel | `https://coolify.hospeda.com.ar` | Scenarios 3 + 4 (deploys, env vars, resource health) |
| Cloudflare DNS | `dash.cloudflare.com/.../hospeda.com.ar/dns` | Scenario 1 step 13 (DNS cutover) |
| Cloudflare R2 | `dash.cloudflare.com/.../r2/buckets/hospeda-backups` | Confirm backup objects exist; manual delete if R2 fills up |
| Sentry | `sentry.io/organizations/hospeda/issues/` | Every scenario step 1 (error volume + first trace) |
| Better Stack | `betterstack.com/uptime` | Every scenario step 1 (which monitors are red) |
| Brevo (transactional email) | `app.brevo.com` | If users report "did not receive verification email" |
| MercadoPago dashboard | `mercadopago.com.ar/developers` | If billing webhooks stop arriving |

---

## Last updated

`2026-05-11` — initial version. Maintained alongside the VPS deployment spec in `docs/migration/vps-deployment-spec.md` (Paso 17.5).
