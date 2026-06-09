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

# from INSIDE the worktree — tear down (stops servers, drops the DB)
pnpm cli wt:down        # or: bash ~/.claude/skills/worktree/scripts/wt-down.sh
```

## Where this lives

The orchestrator scripts (`wt-up.sh`, `wt-down.sh`, `wt-db.sh`, …) live in the
**global worktree skill** at `~/.claude/skills/worktree/scripts/`, driven by this
repo's `.claude/project.config.json`. The repo only ships the CLI entry points
(`wt:up` / `wt:down` / `wt:create` under `pnpm cli`) and that config. This is why
the scripts are not under `scripts/` in the repo.

## Commands

| Command | What it does |
|---------|--------------|
| `pnpm cli wt:up` | Idempotent bring-up. Discovers free ports → ensures the DB is ready → rewrites env → builds shared packages → starts the 3 servers → waits for health → prints the URLs + test logins. |
| `pnpm cli wt:down` | Stops the servers, drops the worktree DB, frees the ports, and prints the `remove` command to delete the worktree from the main repo. |
| `pnpm cli wt:create` | Prints usage. The interactive CLI cannot pass `<type> <slug>` args, so run the script directly (see below). |

Run `wt-up` / `wt-down` from **inside** the worktree directory.

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

`wt:up` guarantees a working DB. If the database is missing, it is created from the
template. If it exists but has no schema (empty), it is **auto-healed**: migrations,
drizzle extras, base seed, and test users run automatically against the worktree DB.
You never have to provision a worktree DB by hand.

### One-time template bootstrap

The shared `hospeda_template` is **not** created automatically. Build it once from
your dev DB (`hospeda_dev`) so every worktree clones it instantly:

```bash
bash ~/.claude/skills/worktree/scripts/wt-db.sh build-template
```

Until the template exists, `wt:up` on a fresh worktree falls back to the slower
auto-heal chain (migrate + seed) instead of the instant template clone.

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

## Tearing down

`wt:down` (from inside the worktree) stops the servers, drops the worktree DB, and
frees the ports. It does **not** delete the worktree itself (git refuses to
self-remove, and deleting a worktree with uncommitted work is irreversible) — it
prints the exact `wt-cleanup.sh remove …` command to run from the main repo.

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| api shows `TIMEOUT` in the health wait | Usually the DB is empty or missing. Re-run `wt:up` — `ensure-ready` auto-heals it. Check `.claude/wt-logs/api.log`. |
| `createdb failed — template ... does not exist` | The `hospeda_template` was never built. Run `wt-db.sh build-template` once. |
| `wt:up` says `already up` but a server is broken | The idempotency check passed (pid alive + serving). If a server is misbehaving, run `wt:down` then `wt:up`. |
| Wrong DB name after switching branches | DB name is path-based now, so this should not happen; if a worktree has an old-style DB recorded in its state, `wt:down` drops it and the next `wt:up` uses the new `worktree_spec_<NNN>` name. |

## See Also

- [Git Branch Workflow](../../.claude/docs/git-branch-workflow.md) — the branch/PR
  flow these worktrees plug into (cut from `staging`, PR to `staging`).
- [Local Development Setup](local-development-setup.md) — base single-checkout dev
  environment (Docker, DB commands, seeding).
- [`packages/seed/CLAUDE.md`](../../packages/seed/CLAUDE.md) — test users matrix.
