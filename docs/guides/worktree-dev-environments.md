# Worktree Dev Environments (one-command up/down)

> Bring up the full Hospeda stack (api + admin + web) for a git worktree with a
> single command — isolated ports, isolated database, test users ready — and tear
> it down just as easily. Designed to be driven by hand or by an agent.

This lets you run **several worktrees in parallel** (e.g. one per feature/spec)
without port or database collisions. Each worktree gets its own free ports and its
own `worktree_*` database inside the shared Postgres container.

## TL;DR

```bash
# from the main repo — create a worktree (manual args, see note below)
bash ~/.claude/skills/worktree/scripts/wt-create.sh feat my-feature

# from INSIDE the worktree — bring everything up
pnpm cli wt:up          # or: bash ~/.claude/skills/worktree/scripts/wt-up.sh

# ...work, test in the browser at the printed URLs...

# from INSIDE the worktree — stop the servers (DB + worktree kept; wt:up restarts instantly)
pnpm cli wt:down        # or: bash ~/.claude/skills/worktree/scripts/wt-down.sh

# when fully done — tear EVERYTHING down (servers + DB + worktree + branch)
pnpm cli wt:remove      # or: bash ~/.claude/skills/worktree/scripts/wt-remove.sh
```

## Two pairs of commands

The lifecycle splits into two symmetric axes — don't conflate them:

- **`create` ⇄ `remove`** — the worktree itself (created ⇄ destroyed).
- **`up` ⇄ `down`** — just the servers (running ⇄ stopped). The DB and worktree
  survive a `down`, so `up` after `down` is instant (no re-provisioning).

## Where this lives

The orchestrator scripts (`wt-up.sh`, `wt-down.sh`, `wt-db.sh`, …) live in the
**global worktree skill** at `~/.claude/skills/worktree/scripts/`, driven by this
repo's `.claude/project.config.json`. The repo only ships the CLI entry points
(`wt:up` / `wt:down` / `wt:remove` / `wt:create` under `pnpm cli`) and that config.
This is why the scripts are not under `scripts/` in the repo.

## Commands

| Command | What it does |
|---------|--------------|
| `pnpm cli wt:up` | Idempotent bring-up. Discovers free ports → ensures the DB is ready → rewrites env → builds shared packages → starts the 3 servers → waits for health → prints the URLs + test logins. |
| `pnpm cli wt:down` | Stops the servers **only**. The DB and the worktree are preserved, so `wt:up` restarts instantly with no re-provisioning. |
| `pnpm cli wt:remove` | Tears **everything** down: stops servers, drops the DB, removes the worktree, and deletes the branch. The opposite of `wt:create`. Works from inside the worktree (it cd's to the main repo for the git removal — see [Removing](#removing-a-worktree)). |
| `pnpm cli wt:create` | Prints usage. The interactive CLI cannot pass `<type> <slug>` args, so run the script directly (see below). |

Run `wt-up` / `wt-down` / `wt-remove` from **inside** the worktree directory.

### Creating a worktree

`wt:create` needs two arguments the CLI cannot forward, so call the script directly
from the main repo:

```bash
bash ~/.claude/skills/worktree/scripts/wt-create.sh <type> <slug>
# e.g.
bash ~/.claude/skills/worktree/scripts/wt-create.sh feat amenities-chips
```

It creates the worktree (branch cut from `staging`), copies the gitignored env
files, installs dependencies, and builds shared packages. The database is **not**
created here — `wt:up` provisions it on demand, so worktrees that never run the app
stay cheap.

## How `wt:up` works

1. **Free ports** — scans ports held by other worktrees (via their state files) and
   by listening processes, then picks a free block. Default ports (3000/3001/4321)
   are never reused.
2. **DB ensure-ready** — verifies the worktree DB **against Postgres** (never trusts
   stale state). See [Database per worktree](#database-per-worktree) for the
   auto-heal behavior.
3. **Env rewrite** — writes the chosen ports and all derived URLs (CORS, auth, API,
   site) into the three `.env.local` files.
4. **Feature env** — applies `.claude/worktree-extra-env.json` if present (see
   [Per-worktree feature env vars](#per-worktree-feature-env-vars)).
5. **Build** — `turbo run build --filter='./packages/*'` (shared packages only; the
   apps run in watch mode and don't need a production build). Turbo-cached, so it's
   cheap when nothing changed. A build failure aborts before starting servers.
6. **Start servers** — launches api/admin/web as process groups, recording pids.
7. **Health wait** — polls each server until ready (HTTP `/health` for the api, TCP
   for admin/web) or a 60s timeout.

`wt:up` is **idempotent**: if all three servers are already alive *and serving*, it
prints the current URLs and exits without touching anything.

## Database per worktree

- **One shared Postgres container** (`hospeda-postgres`, port 5436). Each worktree
  gets its own database `worktree_<slug>` inside it — no extra containers.
- **Naming** derives from the worktree **path** (stable across branch switches): a
  spec number becomes `worktree_spec_197`; otherwise the sanitized directory name.
- **Provisioning** uses the `hospeda_template` template DB for an instant
  `createdb --template`, so a new worktree DB comes up fully seeded in milliseconds.

### Auto-heal

`wt:up` guarantees a working DB. Three cases are handled automatically, so you never
provision a worktree DB by hand:

- **Missing** — the database does not exist: it is created from the template.
- **Empty** (no schema): full provisioning runs — migrations, drizzle extras, base
  seed, and test users.
- **Schema-stale** — the DB has a schema (it looks provisioned) but was cloned from an
  **outdated template** that predates newer tables. This is detected via a configurable
  **sentinel**: `.db.schemaSentinelTables` in `.claude/project.config.json` lists tables
  that must exist in a current schema (e.g. `gastronomies`, `experiences`). If any is
  absent, the schema is healed to the current TS schema with `db:push` + drizzle extras.
  The heal is **additive and non-destructive** — it does **not** reseed, so existing
  rows are preserved and newly created tables come up **empty** (populating them is the
  template's job, see [Refreshing the dev DB & template](#refreshing-the-dev-db--template)).
  A clone whose sentinels are all present is left untouched (a no-op).

> Keep `schemaSentinelTables` pointed at the **most recently added** tables. When a spec
> ships a new table that older templates won't have, add it to the sentinel list so
> stale clones are detected and healed.

### One-time template bootstrap

The shared `hospeda_template` is **not** created automatically. Build it once from
your dev DB (`hospeda_dev`) so every worktree clones it instantly:

```bash
bash ~/.claude/skills/worktree/scripts/wt-db.sh build-template
```

Until the template exists, `wt:up` on a fresh worktree falls back to the slower
auto-heal chain (migrate + seed) instead of the instant template clone.

### Refreshing the dev DB & template

The template is a **snapshot** — it only carries the schema and data that existed when
it was built. When a merged spec ships **schema changes** (new tables, new extras) or
example data you want every fresh worktree to inherit, refresh the source DB and rebuild
the template. Two commands, in order:

```bash
# 1. Rebuild hospeda_dev to the CURRENT schema + seed.
#    DESTRUCTIVE: runs `docker compose down -v`, which DELETES the Postgres volume —
#    hospeda_dev, hospeda_template, and every worktree_* DB in the container — and
#    re-creates it from scratch. Any local data not reproduced by the seed is lost.
#    Only run it when you are fine wiping local data.
pnpm db:fresh-dev

# 2. Rebuild the shared template from the freshly migrated hospeda_dev.
bash ~/.claude/skills/worktree/scripts/wt-db.sh build-template
```

After this, new worktrees clone a current, fully-seeded template and need no heal.
Existing worktrees lost their DB in step 1, but the next `wt:up` re-creates each one
from the refreshed template.

**Cadence.** Re-run the two-command refresh whenever a merged spec adds tables or extras
and you are about to cut new worktrees. If you skip it you are still covered for
**correctness**: the [schema-stale auto-heal](#auto-heal) brings each new worktree's
*schema* up to date on `wt:up`. The refresh is what gives those new tables their
**example data** — without it they stay empty.

**What a fresh worktree contains.** After a refresh + `wt:up`, the worktree DB clones the
current template (sentinel OK, no heal) with the commerce example data seeded: at last
check 6 gastronomy listings, 5 experience listings, 3 commerce owners, plus the dev test
users. Verify with `psql -d worktree_<slug> -c 'SELECT count(*) FROM gastronomies'` and
`… FROM experiences` — both must be `> 0`.

## Test users

After `wt:up`, the worktree DB has the 13 dev test users (every role × plan combo).
Log in with `<slug>@local.test` / `Password123!`. The full matrix is in
[`packages/seed/CLAUDE.md`](../../packages/seed/CLAUDE.md). `wt:up` ensures they
exist (counts first, seeds only if missing).

## Per-worktree feature env vars

To set extra env vars for a feature branch (e.g. a feature flag), create
`.claude/worktree-extra-env.json` in the worktree, keyed by env-file path:

```json
{
  "apps/api/.env.local": { "HOSPEDA_MY_FLAG": "true" },
  "apps/web/.env.local":  { "PUBLIC_MY_FLAG": "true" }
}
```

`wt:up` applies it after the port rewrite. Values support the `{api}` / `{admin}` /
`{web}` port placeholders. This file is **versioned** — do not put secrets in it. See
`.claude/worktree-extra-env.json.example`.

## Stopping vs removing

There are two levels of teardown — pick by intent:

- **`wt:down`** (from inside the worktree) — stops the servers and frees the ports.
  The DB and the worktree stay. Use this between work sessions: `wt:up` brings it
  back instantly.

## Removing a worktree

**`wt:remove`** is the full teardown — the opposite of `wt:create`. It stops the
servers, drops the DB, removes the worktree, and deletes the local branch (add
`--remote` to delete the remote branch too).

It works from **inside** the worktree: it does the parts it can (stop servers, drop
DB), then cd's to the main repo to run `git worktree remove` (git can't self-remove
the worktree your shell sits in). Because a child process can't change your shell's
directory, your terminal is left in a now-deleted folder — `wt:remove` prints a
`cd <main-repo>` reminder. You can also run it from the main repo with an explicit
path: `wt-remove.sh <worktree-path>`.

**Safety (without `--force`):**

- Uncommitted changes in the worktree → it **aborts before touching anything**.
- An unmerged branch → `git branch -d` refuses, so the branch survives (committed
  work is never lost). Re-run with `--force` to discard and `-D` the branch.

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| api shows `TIMEOUT` in the health wait | Usually the DB is empty or missing. Re-run `wt:up` — `ensure-ready` auto-heals it. Check `.claude/wt-logs/api.log`. |
| `createdb failed — template ... does not exist` | The `hospeda_template` was never built. Run `wt-db.sh build-template` once. |
| `wt:up` says `already up` but a server is broken | The idempotency check passed (pid alive + serving). If a server is misbehaving, run `wt:down` then `wt:up`. |
| Wrong DB name after switching branches | DB name is path-based now, so this should not happen. If a worktree has a stale DB recorded in its state, `wt:remove` (or a manual `dropdb`) clears it and the next `wt:up` provisions the correct `worktree_spec_<NNN>` name. |

## See Also

- [Git Branch Workflow](../../.claude/docs/git-branch-workflow.md) — the branch/PR
  flow these worktrees plug into (cut from `staging`, PR to `staging`).
- [Local Development Setup](local-development-setup.md) — base single-checkout dev
  environment (Docker, DB commands, seeding).
- [`packages/seed/CLAUDE.md`](../../packages/seed/CLAUDE.md) — test users matrix.
