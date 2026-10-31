# Hospeda server-tools (`hops`)

Operational CLI for the Hospeda VPS. Wraps the recurring `docker exec`,
`pg-dump/restore`, Coolify dashboard clicks, and R2 bucket pokes behind
a single `hops` command. Built in TypeScript, runs on `bun`, ships as
a compiled binary so the VPS only needs the binary on PATH.

## Status

V1 shipped. 19 commands across 4 tandas, target-aware (`--target=prod|staging`
or `HOPS_DEFAULT_TARGET` env var) since 2026-05-12. See the catalogue below for
the full list. The `Runner` interface in `src/lib/runner.ts` still marks the seam
for a future V2 SshRunner that would let the binary proxy commands over SSH from
a laptop.

## Where it runs (V1)

On the VPS itself. The expected workflow is:

1. SSH to the VPS (`ssh -p 2222 qazuor@216.238.103.219`).
2. Run `hops` interactively or `hops <command> [args]` directly.
3. Exit the SSH session when done.

A future V2 will add a remote-runner mode so the same binary can be
invoked from a laptop and proxy commands over SSH transparently. The
`Runner` interface in `src/lib/runner.ts` is the seam where that lands.

## Install on the VPS (one-time)

The toolkit needs `bun` to compile; once compiled it ships as a single
self-contained binary that does not require bun on the target machine.

### Option A — installer (recommended)

The repo ships an `install.sh` that handles the whole flow: `bun install`,
`bun build --compile`, drops the binary in your chosen location, and
warns if it is not on `PATH`.

```bash
ssh -p 2222 qazuor@216.238.103.219
curl -fsSL https://bun.sh/install | bash      # only the first time
exec $SHELL
cd ~ && git clone https://github.com/qazuor/hospeda.git    # or pull the existing checkout
cd hospeda/scripts/server-tools
./install.sh                                   # interactive; pick ~/.local/bin or /usr/local/bin
hops --version
```

Non-interactive form (CI / automation):

```bash
HOPS_TARGET=~/.local/bin ./install.sh
```

To remove:

```bash
./uninstall.sh                # prompts before removing
HOPS_FORCE=1 ./uninstall.sh   # skip the confirmation prompt
```

### Option B — manual binary copy

If you prefer to compile on a dev machine and `scp` the result:

```bash
cd scripts/server-tools
bun install
bun run build       # produces ./hops-bin
scp -P 2222 hops-bin qazuor@216.238.103.219:/usr/local/bin/hops
ssh -p 2222 qazuor@216.238.103.219 'sudo chmod +x /usr/local/bin/hops'
```

### Option C — run from source on the VPS (development only)

```bash
ssh -p 2222 qazuor@216.238.103.219
curl -fsSL https://bun.sh/install | bash
exec bash
cd ~/hospeda/scripts/server-tools
bun install
echo 'alias hops="bun /home/qazuor/hospeda/scripts/server-tools/src/index.ts"' >> ~/.bashrc
exec bash
```

## Configuration

Copy `.env.local.example` to `.env.local` in this directory on the VPS
and fill in the secrets. The file is gitignored — never commit it.

```bash
cp scripts/server-tools/.env.local.example scripts/server-tools/.env.local
chmod 600 scripts/server-tools/.env.local   # readable only by you
$EDITOR scripts/server-tools/.env.local
```

The example file documents which command needs which value.

### Target environment (prod vs staging)

`hops` runs the same command against either environment via a single
binary. The active target is resolved using the following policy:

**Write/destructive commands** (`explicit-required` policy — redeploy,
exec, psql, db-restore, db-migrate,
db-seed, db-seed-migrate, db-seed-test-users, db-superadmin-pass,
app-restart, restart, cutover-step-3, cutover-step-3b, cutover-step-4c, cutover-step-5b,
r2-lifecycle, r2-purge-foreign-backups, env-set, env-delete, cron-trigger):

- `--target=<prod|staging>` is **mandatory**. The command dies with an
  actionable error if it is omitted.
- `HOPS_DEFAULT_TARGET` is deliberately ignored to prevent accidents.
- Exception: when run from the interactive menu (`hops` with no args),
  the menu prompts for the target on behalf of the operator.

**Read-only / low-risk commands** (`default-ok` policy — find, env-list,
logs, db-counts, db-backup-now, db-migrate-test, env-pull, cron-list):

- Resolution order: `--target=` flag > `HOPS_DEFAULT_TARGET` in `.env.local`
  > interactive prompt.
- When `HOPS_DEFAULT_TARGET` decides the target, a loud warning is printed
  so the operator always knows which environment they hit.

**No-target commands** (`none` policy — docker-by-name, prune, free-mem,
health, update):

- No prod/staging concept. `--target` is accepted on the CLI but ignored.

```bash
hops --target=staging psql 'select 1'        # explicit flag required for psql
hops --target=staging db-counts              # explicit flag or HOPS_DEFAULT_TARGET
hops --target=staging redeploy api           # explicit flag required for redeploy
hops --target=prod db-migrate --no-pull      # explicit flag required for db-migrate
```

**Container resolution never crosses targets** (HOS-1950). prod and
staging run on the same docker daemon and expose the same ports (api 3001,
web 4321, admin 3000), so a container is resolved by its Coolify
`coolify.resourceName` label (`hospeda-<kind>-<target>`, or
`<kind>-database-<UUID>` for postgres/redis). Every container a lookup
returns must prove it belongs to the target, fail-closed:

- A Coolify-managed container (any `coolify.*` label) must carry
  `coolify.resourceName` exactly equal to the expected value. Another value
  (the other target) or no `resourceName` at all is an error.
  `coolify.serviceName` never decides identity.
- A container with no Coolify labels (reached through the image / port
  fallbacks) is accepted only when no container on the daemon, stopped ones
  included, carries `coolify.*` labels (a non-Coolify host), or when
  `HOPS_ALLOW_UNLABELLED_FALLBACK=1` is set.
- `HOPS_PROD_<KIND>_UUID` and `HOPS_STAGING_<KIND>_UUID` may not hold the
  same value.

With the staging app stopped, `hops --target=staging redeploy api` fails
naming the target and the label it looked for, instead of redeploying prod.
Every command that resolves a container prints one line to stderr:

```text
ℹ Resolved api (staging) → container <name> [hospeda-api-staging]
```

A resolution through a fallback is printed as a warning with
`(via <strategy> fallback)` appended.

**`cron-list` / `cron-trigger` honour `--target`.** prod reads
`HOSPEDA_API_URL` (default `https://api.hospeda.com.ar`) and
`HOPS_ADMIN_COOKIE`. staging reads `HOPS_STAGING_API_URL` and
`HOPS_STAGING_ADMIN_COOKIE`, both required with no default: the repo has no
single trustworthy source for the staging API host, so a staging run without
them fails instead of reaching production, and the prod cookie is never sent
to another host. A staging URL on the prod host is rejected too: hostnames
are compared lower-cased, without port or trailing dot, against both
`HOSPEDA_API_URL` and the public prod default.

App container names are stable (`hospeda-<api|web|admin>-<prod|staging>`)
and hardcoded in the code. Database service UUIDs differ per Coolify
deployment, so they live in `.env.local`:

```
HOPS_PROD_POSTGRES_UUID=<paste from `docker inspect ... coolify.resourceName`>
HOPS_PROD_REDIS_UUID=<...>
HOPS_STAGING_POSTGRES_UUID=<...>
HOPS_STAGING_REDIS_UUID=<...>
```

Find a UUID via the container name (the prefix before any hash suffix)
or by inspecting the `coolify.resourceName` label — it looks like
`postgresql-database-<UUID>` or `redis-database-<UUID>`.

> Note: `HOPS_DEFAULT_TARGET` is NOT the same as `HOPS_TARGET`. The
> latter is read only by `install.sh` for the binary install path —
> renaming was easier than overloading.

### `db-migrate` commit guard (HOS-1957)

Cutover step 3 migrates on the same commit as the new image. `db-migrate`
enforces it: whenever a `git pull` happens (`--pull`, or `y` at the prompt) the
command REQUIRES `--expect-commit=<sha>`, the commit the image will be built
from (full SHA recommended; at least 10 hex chars are accepted).

Order: no `--expect-commit` with a pull aborts before pulling; otherwise pull,
read `git rev-parse HEAD`, compare, and only then `pnpm install`, build, backup
and migrate. A mismatch, an unreadable checkout or a blank/`unknown`/non-hex
expected commit aborts with a non-zero exit naming both SHAs and applies
nothing. There is no override flag.

The expected commit is passed by the operator, not read from the api
container: at act (b) the old app is stopped and the new image is not running,
so a container would report the OLD commit. With `--no-pull` the flag is
optional, but when given the checkout is still verified.

```bash
# staging rehearsal: the image is built from origin/staging
hops --target=staging db-migrate --pull --expect-commit=<sha of origin/staging> --yes
# prod cutover: the SHA of the staging -> main promotion merge
hops --target=prod db-migrate --pull --expect-commit=<merge sha> --yes
```

## Catalogue (planned and shipped)

| Command            | Status   | Summary                                                                  |
|--------------------|----------|--------------------------------------------------------------------------|
| `docker-by-name`   | shipped  | Find running container by name prefix.                                   |
| `find`             | shipped  | Resolve container by kind (api/web/admin/postgres/redis/coolify).        |
| `redeploy`         | shipped  | Trigger a Coolify redeploy via the v4 REST API.                          |
| `env-list`         | shipped  | List Coolify env vars on an app (redacted by default; `--reveal` shows values). |
| `exec`             | shipped  | Run a command / open a shell / inspect env inside an app or DB container. |
| `logs`             | shipped  | Tail / follow / grep logs for api / web / admin.                         |
| `psql`             | shipped  | One-shot or interactive psql against the Postgres container.             |
| `db-counts`        | shipped  | Approximate row counts for every user table in the Postgres DB.          |
| `app-restart`      | shipped  | `docker restart` an app container without a full Coolify redeploy.       |
| `free-mem`         | shipped  | Host + per-container memory snapshot with warn threshold.                |
| `health`           | shipped  | Run `scripts/smoke-test.sh` and report (prod / staging).                 |
| `env-set`          | shipped  | Upsert a Coolify env var (production by default; `--preview`, `--secret`, `--yes`). |
| `env-delete`       | shipped  | Delete Coolify env vars by key; `--preview` / `--production` to scope.   |
| `env-pull`         | shipped  | Export Coolify env vars to a local file (mode 0600; redacted by default). |
| `update`           | shipped  | git pull the repo and reinstall the hops binary in one step.             |
| `db-backup-now`    | shipped  | Trigger a `pg_dump` to R2 (`manual/` prefix) outside the daily schedule. |
| `db-restore`       | shipped  | Pick a backup from R2 and `pg_restore` into the container (auto pre-restore snapshot, destructive). `--object <key>` picks by exact name; `--from-target=prod` on `--target=staging` restores a prod backup into staging (refused onto prod); `--target-db <scratch>` creates the scratch DB when missing. See [Restoring a prod backup onto staging](#restoring-a-prod-backup-onto-staging-hos-1957). |
| `r2-purge-foreign-backups` | shipped | List (default) or `--delete` the staging-bucket objects written while staging held prod data. Typed confirmation; refused on prod. |
| `db-seed`          | shipped  | Run `@repo/seed` against the target DB (reset+required+example by default; destructive, optional `git pull` first). `--baseline-stamp` (HOS-1952) is a stamp-only mode: no seed, no wipe, stamps the `seed_migrations` ledger after a reset (`contentOnly` migrations still run); run it after `db-seed`; refused on prod (use `db-seed-migrate`). |
| `db-seed-migrate`  | shipped  | Apply pending seed data-migrations (HOS-25) against the target DB; `--status` to preview. Non-destructive, never reseeds; ledger-tracked exactly-once. |
| `db-migrate`       | shipped  | Apply versioned Drizzle migrations + extras (pre-migrate backup, `--reset`, optional pull). A pull requires `--expect-commit=<sha>` and aborts unless the checkout is that commit (HOS-1957). |
| `cutover-step-3`   | shipped  | Run the V6 cutover step 3 script (writes the five cutover trials) against the target DB; dry-run by default, typed confirmation on prod. |
| `cutover-step-3b`  | shipped  | Run the B9a step 3b tool (the two permanent grants); dry-run by default, `--confirm` writes, typed confirmation on prod. |
| `cutover-step-4c`  | shipped  | Run the V6 step 4c tool (revalidate the deleted listings' pages); dry-run by default, `--confirm-purge` purges, typed confirmation on prod. |
| `cutover-step-5b`  | shipped  | Run the V6 step 5b tool (delete remote photos, revoke calendar tokens); LIST-ONLY by default, `--execute` refused on staging, typed confirmation on prod. |
| `db-seed-test-users` | shipped | Additively seed the 13 SPEC-143 test-user accounts (role×plan matrix). ADD-ONLY, no reset flag; rejected on `--target=prod`. |
| `cron-list`        | shipped  | Numbered list of node-cron jobs registered in the running API process.   |
| `cron-trigger`     | shipped  | Trigger a cron by index, name, or interactive picker (`--dry-run`, `--yes`). |

`cron-edit` is intentionally NOT in V1 — overriding a schedule at runtime
needs a `cron_schedule_overrides` table on the API side. Tracked as a V2
follow-up.

### Cutover wrappers (HOS-1352 steps 3b, 4c, 5b)

The api image has no `tsx`, so the cutover tools in `apps/api/scripts/` cannot
run inside it. These wrappers run them from the `~/hospeda` checkout exactly
like `cutover-step-3`: the api container's environment (never printed), a
host-reachable `HOSPEDA_DATABASE_URL`, the deployed-SHA guard
(`--allow-sha-mismatch` to override), and the script's exit code unchanged.
Every one defaults to a dry-run; a prod write asks for a typed phrase that
`--yes` never skips.

With the target's api STOPPED (the cutover window, when Coolify removes the
container) the wrappers and `cutover-verify` read that environment from the
Coolify API instead (needs a token with `read:sensitive`) and warn that they
did. Only "no running container for this target" falls back; an ambiguous
lookup still aborts. The deployed-SHA guard has no running image to compare
with then, so it refuses unless Coolify holds a usable `HOSPEDA_COMMIT_SHA` or
`SOURCE_COMMIT`; `--allow-sha-mismatch` overrides it. `env-list` never
resolves a container: it finds the app by name in the Coolify API.

| Command | Wraps | Write flag | Prod phrase |
| --- | --- | --- | --- |
| `cutover-step-3b` | `scripts/cutover-b9a-step-3b.ts` | `--confirm` | `grant-permanent-prod` |
| `cutover-step-4c` | `scripts/cutover-v6-step-4c.ts` | `--confirm-purge` | `purge-prod` |
| `cutover-step-5b` | `scripts/cutover-v6-step-5b.ts` | `--execute` (refused on staging) | `delete-remote-prod` |

```bash
# 3b: the two permanent grants. The script validates the UUIDs itself.
hops cutover-step-3b --target=staging --dry-run \
  --actor-user-id=<operator> --beneficiary=<uuid> --beneficiary=<uuid> \
  --plan-id=<uuid> --floor-plan-version-id=<uuid> --includes-addons=true|false
hops cutover-step-3b --target=prod --confirm <same flags>      # types grant-permanent-prod

# 4c: revalidate. Extra files are forwarded as absolute paths (the script
# must support the flags); a missing file is refused before anything runs.
hops cutover-step-4c --target=prod --dry-run [--extra-tags-file=<path>] [--extra-prefixes-file=<path>]
hops cutover-step-4c --target=prod --confirm-purge [same extra files]  # types purge-prod

# 5b: list-only is the default; --execute is the only way to delete/revoke.
hops cutover-step-5b --target=staging                          # rehearsal: list-only, always
hops cutover-step-5b --target=prod --list-only
hops cutover-step-5b --target=prod --execute                   # types delete-remote-prod
```

`cutover-step-5b --execute` is refused on staging because the rehearsal
database is a copy of prod: its photo paths and calendar tokens are prod
resources. The 5b script exits 1 on a list-only run (it maps `dry_run` to 1),
so read the printed `"status":"dry_run"` there rather than the exit code.

## Restoring a prod backup onto staging (HOS-1957)

The V6 cutover rehearsal needs a prod backup inside the STAGING Postgres.

```bash
# 1. Restore a prod backup into the staging main database, by exact name.
hops --target=staging db-restore --from-target=prod \
  --object manual/hospeda-postgres-<TS>.dump.gpg

# 2. Test a backup in a scratch database (created when missing).
hops --target=staging db-restore --object manual/hospeda-postgres-<TS>.dump.gpg \
  --target-db hos1957_scratch

# 3. End of rehearsal: restore the pre-rehearsal staging backup into the
#    main database (this closes the foreign-data window) ...
hops --target=staging db-restore --object manual/hospeda-postgres-<TS-before>.dump.gpg

# 4. ... then list, and delete, what the staging bucket received meanwhile.
hops --target=staging r2-purge-foreign-backups
hops --target=staging r2-purge-foreign-backups --delete
```

- **Source bucket.** `--from-target=prod` lists and downloads from the prod
  bucket with the prod R2 credentials hops already uses for
  `--target=prod` (`R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` /
  `R2_SECRET_ACCESS_KEY` / `R2_BUCKET`). No new variable. Decryption uses
  the same `BACKUP_PASSPHRASE`, so pick a backup taken by
  `hops --target=prod db-backup-now`; a daily-cron backup decrypts only if
  the cron's own env file holds the same passphrase.
- **Refused directions.** Any `--from-target` other than `prod` on
  `--target=prod` is refused before anything runs. Without the flag, a prod
  restore behaves exactly as before.
- **No prod data copied to the staging bucket.** The prod backup goes to a
  `hops-restore-*` temp file (mode 0600) on the VPS and into the container,
  and both are deleted after `pg_restore`.
- **But the staging bucket receives prod data afterwards.** From the restore
  on, the staging database holds prod data, so every backup written into the
  staging bucket carries it: the pre-restore snapshot of every later
  restore, `db-backup-now`, the `db-migrate` backup and the daily cron. The
  restore writes a data-free marker under `hops-foreign-data/` right before
  `pg_restore`; restoring a backup older than that marker into the MAIN
  database writes the closing marker. `r2-purge-foreign-backups` lists
  every object written in between, whatever its name.
- **`r2-purge-foreign-backups --delete`** asks you to type the bucket name,
  refuses while the window is still open, deletes the markers last, re-lists
  to verify, and also removes leftover `hops-restore-*` temp files on the
  host. It is refused on `--target=prod`, and when the staging bucket
  resolves to the prod bucket. It does NOT drop scratch databases created
  with `--target-db`: do that by hand.
- **`--target-db`** accepts `^[a-z_][a-z0-9_]{0,62}$`, refuses the target's
  main database and `postgres` / `template0` / `template1`, and runs
  `CREATE DATABASE "<name>"` when the database does not exist. The
  pre-restore snapshot dumps the database being replaced (none for a newly
  created one).

## Conventions

- **stdout vs stderr**: every command writes its primary output to
  stdout (so it pipes cleanly) and progress / status / errors to stderr.
- **No silent guesses**: when a lookup or filter would have to pick one
  of multiple matches, the command refuses and lists candidates.
- **Confirm before destruction**: any command that mutates production
  state (delete, restore, env-set with secret value) prompts before
  proceeding. `--yes` flag bypasses the prompt for automation.
- **All secrets read from `.env.local`**: never hard-coded, never on the
  command line, never echoed back to the operator.
