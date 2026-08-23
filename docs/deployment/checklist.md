# Deployment Checklist

Deployment checklist for the Hospeda monorepo. Covers all three applications — API,
Web and Admin — which run as Docker containers on a **self-hosted VPS orchestrated by
[Coolify](https://coolify.hospeda.com.ar)**, behind Cloudflare.

**Last Updated**: 2026-08-23

> **This document was rewritten on 2026-08-23.** Every previous version described a
> Vercel deployment: `vercel.json` files, `vercel rollback`, `cd-staging.yml` /
> `cd-production.yml` workflows, Neon point-in-time recovery and a `pnpm db:rollback`
> script. **None of those exist in this repository.** If you find another deployment
> document still describing Vercel or Neon, treat it as fiction and fix it.

---

## Table of Contents

1. [Platform in One Screen](#platform-in-one-screen)
2. [Pre-Deployment Checks](#pre-deployment-checks)
3. [Promoting to Production](#promoting-to-production)
4. [Database Migrations](#database-migrations)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Rollback Procedures](#rollback-procedures)
7. [CI Reference](#ci-reference)
8. [Quick Reference: Commands](#quick-reference-commands)

---

## Platform in One Screen

| Piece | Reality |
| --- | --- |
| Host | Self-hosted VPS, orchestrated by Coolify (`https://coolify.hospeda.com.ar`) |
| Build artifact | `apps/api/Dockerfile`, `apps/web/Dockerfile`, `apps/admin/Dockerfile` |
| Coolify apps | `hospeda-api-prod`, `hospeda-web-prod`, `hospeda-admin-prod` (and the `-staging` triplet) |
| Deploy trigger | **Manual**, by policy. Auto-deploy on push is disabled deliberately |
| CLI | `hops`, source in `scripts/server-tools/`, run from the VPS |
| Database | PostgreSQL in a Coolify-managed container. **Not Neon** |
| Edge | Cloudflare |

CI (`.github/workflows/ci.yml`) runs lint, typecheck and tests. **It does not deploy.**
The deploy is a human action: a button in the Coolify dashboard, or `hops redeploy`.

---

## Pre-Deployment Checks

### Code Quality

- [ ] All tests pass: `pnpm test`
- [ ] TypeScript compiles without errors: `CI=true pnpm typecheck`
      (without `CI=true` the task exits without ever running `tsc` and prints nothing)
- [ ] Biome linting passes: `pnpm lint`
- [ ] Build succeeds locally: `pnpm build`
- [ ] No `any` types in new code (TypeScript strict mode enforced)

### Branch State

- [ ] The change reached `staging` through a PR whose **`CI Pass` check is `SUCCESS`**
      — asserted, not merely "no failures". A pending check reports `conclusion` as an
      **empty string**, not `null`, so a naive `jq` fallback reads it as green
- [ ] No `status-needs-smoke-*` label is still outstanding on any issue this release closes

### Environment Variables and Secrets

Managed with `hops env-*` from the VPS, or through the Coolify UI per app.

- [ ] `pnpm env:check:registry` passes locally (the CI gate for registry drift)
- [ ] `hops env-list --target=<prod|staging>` shows every variable the release needs
- [ ] `hops env-doctor` / `hops env-check-rules` report no inconsistency between environments
- [ ] Any newly registered variable is actually **set in Coolify** for every environment
      that needs it — a registered-but-unset variable is the classic silent failure
- [ ] `PUBLIC_*` (web) and `VITE_*` (admin) variables are **inlined at build time**:
      changing one requires a **redeploy**, not just a save

### Dependencies

- [ ] `pnpm-lock.yaml` is up to date and committed
- [ ] `pnpm audit` is clean, or every finding is a known, tracked baseline artifact
- [ ] Use `corepack pnpm` — a stray global pnpm 9 silently wipes the workspace overrides

---

## Promoting to Production

`main` is the validated baseline; `staging` is the integration line. The only path:

1. Merge the work into `staging` through PRs.
2. Open a PR `staging` → `main`.
3. Wait for `CI Pass` to be `SUCCESS`.
4. `gh pr merge --merge` (never `--admin` to bypass a red CI).
5. Redeploy each app.

```bash
# From the VPS — triggers a Coolify build + deploy
hops redeploy api
hops redeploy web
hops redeploy admin
```

Or the equivalent: open `https://coolify.hospeda.com.ar`, pick the app, hit Redeploy.

> ⚠️ **The promotion to `main` is a safety precondition for the seed data-migrations,
> not just the release step.**
>
> `hops db-seed-migrate` runs the migration code from the VPS checkout, which tracks
> `main`. If a data-migration was corrected on `staging` and that correction has not
> been promoted, the run executes the **old, uncorrected** version against production.
>
> This is not hypothetical: on 2026-08-23 `main`'s copy of
> `0068-hos-749-prod-billing-cleanup` was missing `PRESERVED_CUSTOMER_IDS` (added on
> `staging` by PR #2987), so running it then would have soft-deleted the billing
> records of six real people plus the staff account.
>
> **Always promote first, then migrate.** Before any prod seed-migration run, diff the
> pending migration files between `main` and `staging` and confirm they are identical.

---

## Database Migrations

There are **three rails**, applied by **two commands** — `hops db-migrate` bundles the
first two. Count rails, not commands, when working out what a release still owes:

| Rail | What it carries | Applied by |
| --- | --- | --- |
| 1. Schema | `packages/db/src/migrations/*.sql` (tables, columns, indexes, FKs, enums) | `hops db-migrate` |
| 2. Extras | `packages/db/src/migrations/extras/*.sql` (triggers, matviews, CHECKs, special indexes) | `hops db-migrate` |
| 3. Seed data | `packages/seed/src/data-migrations/NNNN-*.ts`, ledgered in `seed_migrations` | `hops db-seed-migrate` |

They run in that order.

`hops db-migrate` takes a `pg_dump` backup, runs `drizzle-kit migrate`, then
`db:apply-extras` — all in one step. Never run `drizzle-kit` by hand on the VPS, and
**never `drizzle-kit push`** against staging or production.

> **Deploy order matters — read this before running a migration against staging/prod.**
> `hops db-migrate` and the application redeploy are two separate, non-atomic actions.
> Running the migration first is safe for almost every change, but a **`DROP COLUMN`**
> migration run before the new app code is live breaks the STILL-RUNNING old container
> from the instant it applies — Drizzle projects an explicit column list, never
> `SELECT *`. This is not theoretical: it caused an 8-minute `accommodations` 404
> outage on the 2026-08-18 release (HOS-601). If the migration set for this deploy
> contains a `DROP COLUMN`, it MUST already be paired with a PR that carries a
> `[drop-column-release-gap: ...]` marker (CI-enforced — see
> `scripts/check-drop-column-release-gap.sh`); if you find one that isn't, stop and read
> [`docs/guides/migrations.md`](../guides/migrations.md#deploy-order-drop-column-ships-one-release-after-the-code-stops-using-it)
> before proceeding.

### Rehearsing a migration batch

- [ ] `hops db-seed-migrate --target=prod --status` — read-only, lists applied vs pending
- [ ] `hops db-migrate-test --target=prod` — clones the live DB into a scratch database
      inside the **same** Postgres container and runs the migrate sequence against the clone

> ⚠️ **`db-migrate-test` rehearses only two of the three rails.** It runs
> `drizzle-kit migrate` + `db:apply-extras`. It does **not** run `db:seed:migrate`, so
> pending seed data-migrations are never exercised by it.
>
> To rehearse the seed rail too, keep the scratch clone and point the seed at it:
>
> ```bash
> hops db-migrate-test --target=prod --keep     # leaves hospeda_migrate_test_<timestamp>
> # then run the seed data-migrations against that scratch DB, overriding
> # HOSPEDA_DATABASE_URL to point at the scratch database
> ```
>
> **The rehearsal MUST run with `NODE_ENV=production`.** Several production-only
> migrations (`0058`, `0059`, `0065`, `0068`) are gated by
> `if (process.env.NODE_ENV !== 'production') return { summary: 'Skipped: ...' }`.
> Without that variable they report `Skipped`, get ledgered as applied, and execute
> nothing — the rehearsal then proves exactly nothing. This is also why "it ran fine on
> staging" is **not** evidence for those four: on staging they were skipped, not run.
>
> Rehearsing against a clone of production data is the only meaningful test. HOS-712
> found that `0059` aborts on rows that exist **only** in production.

- [ ] The rehearsal covered the **full** pending batch, not just the first migration
- [ ] `pnpm db:generate` produces no new files (no uncommitted schema drift)
- [ ] A fresh backup exists: `hops db-backup-now --target=prod`

---

## Post-Deployment Verification

### Smoke Tests

- [ ] **API**: `GET /health` returns 200
- [ ] **API**: `GET /api/v1/public/accommodations` returns data
- [ ] **API**: authentication endpoints respond correctly
- [ ] **Web**: homepage loads (`/es/`)
- [ ] **Web**: accommodation listing loads (`/es/alojamientos/`)
- [ ] **Web**: destination listing loads (`/es/destinos/`)
- [ ] **Web**: i18n works across `/es/`, `/en/`, `/pt/`
- [ ] **Admin**: login page loads
- [ ] **Admin**: dashboard loads after authentication
- [ ] **Admin**: entity lists render (accommodations, users)

For billing changes the manual smoke checklists are the real gate — the vitest e2e
suite uses a MercadoPago stub and cannot catch divergence from real MP behaviour.

### Monitoring

- [ ] Sentry is receiving events ([qazuor.sentry.io](https://qazuor.sentry.io)) —
      projects `hospeda-api`, `hospeda-web`, `hospeda-admin`
- [ ] `hops logs api --since 2m` shows no elevated error rate

> ⚠️ The staging access log emits only `ERROR` and `WARN`. **A successful 200 is
> invisible there**, so "no incoming requests" read off that log is not a finding.

- [ ] `hops free-mem` reports healthy headroom

### Database

- [ ] `hops db-seed-migrate --target=prod --status` shows zero pending
- [ ] `hops db-counts --target=prod` matches expectations

> ⚠️ `hops psql` returns **empty output with exit code 0** on invalid SQL (an unknown
> column, a bad `::` cast). Empty is not "zero rows". Verify the query shape before
> drawing any conclusion from silence.

---

## Rollback Procedures

### Application Rollback

Coolify keeps previous deployments per app. Roll back from the dashboard by
redeploying the previous successful build for `hospeda-<app>-prod`.

```bash
hops app-restart <api|web|admin>   # restart only, does not change the image
hops logs api --since 5m           # confirm what broke first
```

### Database Rollback

**There is no `pnpm db:rollback`. That script does not exist.** Recovery is
restore-from-backup:

```bash
hops db-backup-now --target=prod          # take one BEFORE any risky operation
hops db-restore    --target=prod [--target-db <name>]
```

`hops db-migrate` takes a `pg_dump` before applying, which is the safety net for a
failed schema migration.

Seed data-migrations behave differently:

- The runner **stops at the first failure**. That migration's transaction rolls back
  with no ledger row, and **later pending migrations never run** — you are left partway
  through the batch. This is what the rehearsal above exists to prevent.
- Migrations that **soft**-delete are reversible by clearing `deleted_at`.
- Migrations that **hard**-delete (`0058`, `0059`, `0065`) are not. Those need the backup.

### Emergency Checklist

- [ ] Identify the issue (Sentry, `hops logs`)
- [ ] Decide which app(s) need rollback
- [ ] Roll back the affected app(s)
- [ ] If a schema migration caused it, restore the pre-migration backup **first**, then the app
- [ ] Verify `/health` passes after rollback
- [ ] Notify the team and record the root cause on the tracking issue

---

## CI Reference

CI validates; it does not deploy. The workflows that actually exist:

| Workflow | Purpose |
| --- | --- |
| `ci.yml` | Lint, typecheck, build, unit + integration tests. `CI Pass` is the merge gate |
| `e2e-pr.yml`, `e2e-nightly.yml`, `e2e-local.self-hosted.yml` | End-to-end suites |
| `lighthouse.yml` | Performance budget per PR |
| `a11y-sweep.yml` | Accessibility sweep |
| `codeql.yml`, `codeql-staging.yml` | Static security analysis |
| `validate-pr-title.yml` | Enforces the `[HOS-NNN]` / `[NOSPEC:<slug>]` work tag |
| `validate-docs.yml`, `docs.yml` | Documentation link and format checks |
| `smoke-gate-sync.yml` | Moves an issue to *In Review* when it still carries a `status-needs-smoke-*` label |
| `sync-main-to-staging.yml` | Opens the mandatory back-merge PR after any merge to `main` |

> After **every** merge to `main`, back-merging `main` → `staging` is mandatory.
> `sync-main-to-staging.yml` opens that PR automatically; if it does not run, do it by
> hand. Skipping it moves the baseline mismatch from `main` to `staging` rather than
> avoiding it.

---

## Quick Reference: Commands

```bash
# ---- local ----
pnpm install --frozen-lockfile
pnpm build
CI=true pnpm typecheck
pnpm env:check:registry

# ---- VPS: deploy ----
hops redeploy    <api|web|admin>
hops app-restart <api|web|admin>
hops logs api --since 2m

# ---- VPS: environment ----
# NOTE: env-set takes the APP as its first argument, and --target= is REQUIRED
# (it writes data, so HOPS_DEFAULT_TARGET is deliberately not honoured).
hops env-set --target=<prod|staging> <api|web|admin> <KEY> <VALUE>
hops env-set --target=<prod|staging> <api|web|admin> <KEY> --secret   # masked prompt
hops env-list --target=<prod|staging>
hops env-doctor
hops env-check-rules

# ---- VPS: database ----
hops db-backup-now   --target=prod
hops db-migrate-test --target=prod [--keep]   # rehearse rails 1-2 on a scratch clone
hops db-migrate      --target=prod            # backup + drizzle migrate + apply-extras
hops db-seed-migrate --target=prod --status   # read-only: applied vs pending
hops db-seed-migrate --target=prod            # apply pending seed data-migrations
hops db-counts       --target=prod
hops db-restore      --target=prod
```

Run `hops <command> --help` for the authoritative flags — `scripts/server-tools/` is
the source of truth, not this table.
