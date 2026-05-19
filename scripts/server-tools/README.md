# Hospeda server-tools (`hops`)

Operational CLI for the Hospeda VPS. Wraps the recurring `docker exec`,
`pg-dump/restore`, Coolify dashboard clicks, and R2 bucket pokes behind
a single `hops` command. Built in TypeScript, runs on `bun`, ships as
a compiled binary so the VPS only needs the binary on PATH.

## Status

V1 shipped. 19 commands across 4 tandas, target-aware (`--target=prod|staging`,
or `HOPS_DEFAULT_TARGET` env var, defaulting to `prod`) since 2026-05-12. See
the catalogue below for the full list. The `Runner` interface in
`src/lib/runner.ts` still marks the seam for a future V2 SshRunner that would
let the binary proxy commands over SSH from a laptop.

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
binary. The active target is resolved in this order, first hit wins:

1. `--target=<prod|staging>` flag on the command line.
2. `HOPS_DEFAULT_TARGET` env var in `.env.local`.
3. Default: `prod`.

```bash
hops psql 'select 1'                         # prod (default)
hops --target=staging psql 'select 1'        # staging override
hops --target=staging db-counts              # row counts in staging DB
hops --target=staging redeploy api           # redeploy hospeda-api-staging
```

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
| `db-restore`       | shipped  | Pick a backup from R2 and `pg_restore` into the container (auto pre-restore snapshot, destructive). |
| `db-seed`          | shipped  | Run `@repo/seed` against the target DB (reset+required+example by default; destructive, optional `git pull` first). |
| `cron-list`        | shipped  | Numbered list of node-cron jobs registered in the running API process.   |
| `cron-trigger`     | shipped  | Trigger a cron by index, name, or interactive picker (`--dry-run`, `--yes`). |

`cron-edit` is intentionally NOT in V1 — overriding a schedule at runtime
needs a `cron_schedule_overrides` table on the API side. Tracked as a V2
follow-up.

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
