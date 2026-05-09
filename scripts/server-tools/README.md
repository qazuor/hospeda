# Hospeda server-tools (`hctl`)

Operational CLI for the Hospeda VPS. Wraps the recurring `docker exec`,
`pg-dump/restore`, Coolify dashboard clicks, and R2 bucket pokes behind
a single `hctl` command. Built in TypeScript, runs on `bun`, ships as
a compiled binary so the VPS only needs the binary on PATH.

## Status

V1 is in active build. The first commits ship the core scaffolding
(runner + docker wrapper + container lookup) plus the two simplest
commands (`docker-by-name`, `find`). The rest of the catalogue (api-exec,
api-logs, pg-exec, db-restore, redeploy, env-set, cron-list, …) lands in
follow-up commits.

## Where it runs (V1)

On the VPS itself. The expected workflow is:

1. SSH to the VPS (`ssh -p 2222 qazuor@216.238.103.219`).
2. Run `hctl` interactively or `hctl <command> [args]` directly.
3. Exit the SSH session when done.

A future V2 will add a remote-runner mode so the same binary can be
invoked from a laptop and proxy commands over SSH transparently. The
`Runner` interface in `src/lib/runner.ts` is the seam where that lands.

## Install on the VPS (one-time)

The toolkit needs `bun` for development; for production usage on the VPS
the easiest path is the compiled binary.

### Option A — compiled binary (recommended for the VPS)

From your dev machine, with bun installed:

```bash
cd scripts/server-tools
bun install
bun run build       # produces ./hctl-bin
scp -P 2222 hctl-bin qazuor@216.238.103.219:/usr/local/bin/hctl
ssh -p 2222 qazuor@216.238.103.219 'sudo chmod +x /usr/local/bin/hctl'
```

Then on the VPS:

```bash
hctl --help
```

### Option B — bun + repo checkout on the VPS

```bash
ssh -p 2222 qazuor@216.238.103.219
curl -fsSL https://bun.sh/install | bash
exec bash   # reload PATH
cd ~ && git clone https://github.com/qazuor/hospeda.git
cd hospeda/scripts/server-tools
bun install
echo 'alias hctl="bun /home/qazuor/hospeda/scripts/server-tools/src/index.ts"' >> ~/.bashrc
exec bash
hctl --help
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

## Catalogue (planned and shipped)

| Command            | Status   | Summary                                                                  |
|--------------------|----------|--------------------------------------------------------------------------|
| `docker-by-name`   | shipped  | Find running container by name prefix.                                   |
| `find`             | shipped  | Resolve container by kind (api/web/admin/postgres/redis/coolify).        |
| `redeploy`         | shipped  | Trigger a Coolify redeploy via the v4 REST API.                          |
| `env-list`         | shipped  | List Coolify env vars on an app (redacted by default; `--reveal` shows values). |
| `exec`             | shipped  | Run a command / open a shell / inspect env inside an app or DB container. |
| `logs`             | shipped  | Tail / follow / grep logs for api / web / admin (replaces `*-logs`).     |
| `psql`             | shipped  | One-shot or interactive psql against the Postgres container.             |
| `app-restart`      | planned  | `docker restart` an app container without a full Coolify redeploy.       |
| `db-counts`        | planned  | Row-count snapshot for the seeded reference tables.                      |
| `db-backup-now`    | planned  | Trigger a `pg_dump` to R2 outside the daily schedule.                    |
| `db-restore`       | planned  | List backups in R2 numbered, restore by number with confirmation.        |
| `redeploy`         | planned  | Trigger a Coolify redeploy for api/web/admin via the Coolify REST API.   |
| `env-list`         | planned  | List Coolify env vars for an app, values redacted.                       |
| `env-set`          | planned  | Update a single Coolify env var; secret values prompt for confirmation.  |
| `env-pull`         | planned  | Export Coolify env vars to a local file (redacted by default).           |
| `cron-list`        | planned  | Numbered list of in-process node-cron jobs (name, schedule, last run).   |
| `cron-trigger`     | planned  | Trigger a cron by its number from `cron-list`.                           |
| `health`           | planned  | Run `scripts/smoke-test.sh` and report.                                  |
| `free-mem`         | planned  | Host + per-container memory snapshot with warn threshold.                |

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
