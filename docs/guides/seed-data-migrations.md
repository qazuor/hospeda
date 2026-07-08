# Seed Data Migrations Guide

This is the canonical how-to for **versioned seed data migrations** (HOS-25) — the carril
that lets seed DATA evolve on already-deployed environments the same way `packages/db/src/migrations/`
lets the schema evolve. For the schema carriles themselves see
[docs/guides/migrations.md](migrations.md). For the full design record see
[`.specs/HOS-25-versioned-seed-data-migrations/spec.md`](../../.specs/HOS-25-versioned-seed-data-migrations/spec.md).

---

## What & why

Before HOS-25, `packages/seed` only knew how to build a database **from scratch**:
`pnpm db:seed` (`--reset --required --example`) wipes everything and re-seeds it. That is
fine for local dev and CI, but it left no way to push a change to baseline seed data —
a new amenity, a renamed billing-plan limit, a removed catalog entry — onto staging or
production, which are never reset. The only escape hatch used to be a one-off hand-written
SQL file under `packages/db/src/migrations/extras/` (see the billing `023`/`024`/`025-*.plan.sql`
files, now superseded — [below](#the-extras-vs-data-migrations-boundary-oq-3)).

Versioned seed data migrations fix this with a dedicated carril:

- A ledger table, `seed_migrations` (`packages/db/src/schemas/seed-migrations/`), records which
  migrations have run. Unlike application data, this table is **preserved across `--reset`** —
  it is the migration history, not seedable content.
- Migration modules live in `packages/seed/src/data-migrations/NNNN-slug.ts`, numbered like
  Drizzle's own `NNNN_name.sql` files, and are applied once, in order, never re-run.
- A fresh database (local dev, CI, a brand-new staging/prod DB) never needs to run these
  modules for real — the baseline seed already produces the target end state directly. It
  gets **baseline-stamped** instead (see [below](#baseline-stamp-marking-a-fresh-db-caught-up)).
- An already-seeded environment that predates a given migration runs it for real, exactly
  once, the next time `pnpm db:seed:migrate` executes there.

---

## Quick reference

| Command | Purpose |
|---------|---------|
| `pnpm db:seed:make <slug>` | Scaffold a new `NNNN-<slug>.ts` migration file |
| `pnpm db:seed:migrate` | Run every pending migration (all groups) |
| `pnpm db:seed:migrate --required` / `--example` | Scope a run to one group |
| `pnpm db:seed:migrate:status` | Print applied/pending status for every migration |
| `pnpm --filter @repo/seed seed --data-migrate --baseline-stamp` | Mark every pending migration applied WITHOUT running `up()` |

These are thin root aliases over the `@repo/seed` CLI's `--data-migrate*` flags (see
`packages/seed/src/cli.ts`). `pnpm db:fresh` and `pnpm db:fresh-dev` already chain the
baseline-stamp step automatically after the main seed — see
[Baseline-stamp](#baseline-stamp-marking-a-fresh-db-caught-up).

---

## Run order (critical)

A data migration that needs a new column, table, or enum value can only run **after** the
schema change that adds it. The three carriles must therefore always apply in this exact
order:

```bash
pnpm db:migrate        # 1. Schema: Drizzle-generated structural migrations
pnpm db:apply-extras   # 2. DB objects: triggers, matviews, CHECK constraints
pnpm db:seed:migrate    # 3. Data: versioned seed data migrations
```

Why this order, concretely: if a migration's `up()` writes to a column that a schema
migration adds, running `db:seed:migrate` before `db:migrate` fails at the first `INSERT`/
`UPDATE` referencing that column. `db:apply-extras` sits in the middle because extras objects
(e.g. a CHECK constraint) can themselves depend on the schema migration that just ran, and a
data migration could in principle depend on an extras object (e.g. a trigger) existing.
`hops db-migrate` already runs steps 1-2 in this order on the VPS; step 3 (`pnpm db:seed:migrate`)
is a separate, explicit command — it is not currently wired into `hops db-migrate` — so an
operator promoting a schema+data change together must run it as its own step after `hops
db-migrate` completes.

---

## Writing a data migration

### Scaffold it

```bash
pnpm db:seed:make remove-legacy-feature
# -> packages/seed/src/data-migrations/0004-remove-legacy-feature.ts
```

Slugs must be **lowercase kebab-case**, starting with a letter (letters/digits/hyphens only —
no spaces, no camelCase, no leading/trailing/double hyphens). Uppercase input is silently
lowercased; anything else invalid is rejected rather than auto-corrected. `db:seed:make` scans
the directory for the highest existing `NNNN` prefix and writes the next one — you never pick
the number yourself.

```bash
pnpm db:seed:make remove-legacy-feature --group=example    # default: required
pnpm db:seed:make remove-legacy-feature --destructive       # marks meta.destructive = true
```

(`pnpm db:seed:make` is the root alias for `pnpm --filter @repo/seed seed --data-migrate-make <slug>`.)

### Module shape

Every migration file exports exactly two things, validated against
`packages/seed/src/data-migrations/types.ts`:

```ts
export const meta = {
    name: '0004-remove-legacy-feature', // MUST equal the filename stem
    group: 'required',                  // 'required' | 'example'
    destructive: false                  // see "destructive flag" below
} as const satisfies SeedMigrationModule['meta'];

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    // ... perform the migration using ctx.db / ctx.models / ctx.services / ctx.helpers
    return { summary: 'Removed the legacy-feature catalog row' };
}
```

Discovery loads `meta` without ever importing/executing `up()`'s side effects, and enforces
that `meta.name` matches the file's own stem — a mismatch is a scaffolding bug, not something
you should hand-edit around.

### What `ctx` gives you

`up(ctx)` receives a single RO-RO context object (`SeedMigrationCtx`, built by
`packages/seed/src/data-migrations/context.ts`):

| Field | What it is |
|-------|------------|
| `ctx.db` | The **transaction-scoped** Drizzle client for this migration only. The runner wraps each migration in its own `db.transaction(...)`; a throw rolls back both the migration's writes and its ledger row, atomically. Always use `ctx.db`, never a fresh `getDb()` call, inside `up()`. |
| `ctx.actor` | A super-admin `Actor` (bootstrapped via `loadSuperAdminAndGetActor()` unless the caller injected one), for permission-checked `@repo/service-core` writes. |
| `ctx.models` | The full `@repo/db` model surface (every `*Model` export), keyed exactly as `@repo/db` exports it — construct one directly: `new ctx.models.AmenityModel()`. |
| `ctx.services` | The full `@repo/service-core` service surface (every `*Service` export) — `new ctx.services.AmenityService({ logger }).create(ctx.actor, data)`. |
| `ctx.helpers.safeDelete` | FK-guarded, operator-edit-aware hard delete (see below). Bound to `ctx.db` already — no need to thread a client through it. |

### Raw-Drizzle example

The billing `0001`-`0003` migrations (ported from the now-superseded `extras/023-025-*.plan.sql`
files) are the reference examples for a direct-SQL, OR-PRESERVE-style update. From
`packages/seed/src/data-migrations/0001-billing-plans-ai-consumer-search-limits.ts`:

```ts
import { and, billingPlans, type DrizzleClient, inArray, sql } from '@repo/db';

async function orPreserveLimit(
    db: DrizzleClient,
    key: string,
    value: number,
    planNames: readonly string[]
): Promise<number> {
    const updated = await db
        .update(billingPlans)
        .set({
            limits: sql`${billingPlans.limits} || jsonb_build_object(${key}::text, ${value}::int)`,
            updatedAt: new Date()
        })
        .where(
            and(
                inArray(billingPlans.name, [...planNames]),
                sql`NOT (${billingPlans.limits} ? ${key})` // never overwrite an already-present key
            )
        )
        .returning({ id: billingPlans.id });

    return updated.length;
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const rows = await orPreserveLimit(ctx.db, 'max_ai_search_per_month', 10, ['tourist-free']);
    return { summary: `Set "max_ai_search_per_month" on ${rows} plan row(s).` };
}
```

The `NOT (limits ? key)` guard is what makes re-running this migration a safe no-op: it only
ever fills in a *missing* key, never clobbers a value an admin edited later through the
runtime plan editor. Every migration should be written to be idempotent on re-run in spirit,
even though the runner itself never re-runs an already-ledgered migration.

### `helpers.safeDelete` example

Never issue a raw `DELETE` from a migration. Use `ctx.helpers.safeDelete`, which guards
against active inbound FK references and (optionally) operator-edited rows before deleting
anything:

```ts
import { eq, features } from '@repo/db';

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const result = await ctx.helpers.safeDelete({
        table: features,
        where: eq(features.slug, 'legacy-feature'),
        reason: 'Superseded by SPEC-266 amenity/feature catalog rework'
        // isOperatorEdited: (row) => row.description !== DEFAULT_DESCRIPTION, // optional
    });

    return result.deleted
        ? { summary: 'Deleted legacy-feature catalog row' }
        : { summary: `Skipped delete: ${result.reason}` };
}
```

Behavior:

- `where` matching **zero** rows is an idempotent no-op success (`{ deleted: true }`) — the
  desired end state (row absent) already holds.
- `where` matching **more than one** row throws — narrow it to a single row (PK or another
  unique column).
- An active inbound FK reference, or (when supplied) a truthy `isOperatorEdited(row)`
  predicate, withholds the delete and returns `{ deleted: false, skipped: true, reason }`
  instead of cascading. `isOperatorEdited` receives the row keyed by its raw snake_case DB
  column names (not the Drizzle camelCase JS properties) — pass one only for tables with a
  real operator-edit provenance signal (e.g. `billing_plans`'s Model C commercial layer);
  omit it for catalog tables with no such surface (amenities, features, tags, ...).

---

## The dual-write rule

The root [`CLAUDE.md`](../../CLAUDE.md) states the mandatory rule under "Seed dual-write rule
(MANDATORY, HOS-25)" — read it there for the exact wording; summarized: **any PR that edits
baseline seed data already present on a live environment must, in the same PR, both (1) edit
the baseline fixture/constant AND (2) add a numbered data migration** (`pnpm db:seed:make
<slug>`) that applies the same delta to already-seeded staging/prod. Editing only the
baseline is a silent bug — fresh DBs get it right, live DBs never do.

### CI guard

`scripts/check-seed-dual-write.sh` enforces this in CI: it diffs the PR's changed files
against the base ref and, if any **guarded** path changed without a new
`packages/seed/src/data-migrations/NNNN-*.ts` file also being added, fails the build.

Guarded paths (required-data only — `example/` fixtures are excluded, since they are
non-deterministic content regenerated on every reseed, except where a migration deliberately
targets a deterministic `example` fixture id — see [OQ-1 note](#example-migrations-and-deterministic-fixture-ids)):

```
packages/seed/src/data/amenity/**
packages/seed/src/data/attraction/**
packages/seed/src/data/destination/**
packages/seed/src/data/exchangeRate/**
packages/seed/src/data/exchangeRateConfig/**
packages/seed/src/data/feature/**
packages/seed/src/data/revalidationConfig/**
packages/seed/src/data/sponsorshipLevel/**
packages/seed/src/data/sponsorshipPackage/**
packages/seed/src/data/postTag/**
packages/seed/src/data/user/required/**
packages/seed/src/data/tag/{internal,system}-*.json     (data/tag/ is a MIXED folder — only these prefixes are guarded)
packages/billing/src/config/{plans,limits,entitlements,addons,promo-codes}.config.ts
```

**Known v1 gap**: several `required/*.seed.ts` files carry their own inline TS baseline-data
constants instead of reading a `data/**/*.json` folder — `rolePermissions.seed.ts`,
`aiPrompts.seed.ts`, `aiSettings.seed.ts`, `socialAutomation.seed.ts`,
`contentModeration.seed.ts`, `systemUser.seed.ts`. The guard does **not** watch these files
(a path-diff guard cannot distinguish a data change from a logic change in an inline
constant without a much higher false-positive rate). If you edit baseline data in one of
these files, apply the dual-write rule manually — the CI guard will not catch a missed
migration there.

### Opt-out

A genuinely safe additive change (a brand-new catalog entry nobody needs backfilled onto
already-seeded environments) can skip the guard by adding a literal marker to the PR
description:

```
[skip-seed-migration]: <reason>
```

The marker is also honored if present in any commit message in the diff range (useful for a
local/manual run of the script). Same trust model as this repo's other magic-word
conventions (e.g. `Closes HOS-N`) — no automated defense beyond PR review backs it.

---

## The extras/ vs data-migrations/ boundary (OQ-3)

Both carriles are hand-authored and versioned, but they own different things:

| Carril | Owns | Applied by |
|--------|------|------------|
| `packages/db/src/migrations/extras/` | Drizzle-invisible DB **objects** — triggers, materialized views, CHECK constraints, special indexes | `pnpm db:apply-extras`, re-run every time, idempotent by construction |
| `packages/seed/src/data-migrations/` | Row-level **data content** — INSERT/UPDATE/DELETE of actual seed rows | `pnpm db:seed:migrate`, run once per migration, tracked in the `seed_migrations` ledger |

If what you're changing can be expressed as "this DB object needs to exist" (a trigger
function, a matview, a cross-column CHECK), it belongs in `extras/`. If it's "this row's
value should be X" (a plan's limit, a catalog entry's existence), it belongs in
`data-migrations/`.

### Worked example: the billing 023/024/025 → 0001/0002/0003 port

Three pre-existing hand-written extras files were exactly this kind of DATA change wearing
the wrong carril's clothes:

- `extras/023-billing-plans-ai-consumer-search-limits.plan.sql` → `data-migrations/0001-billing-plans-ai-consumer-search-limits.ts`
- `extras/024-billing-plans-collections-limit.plan.sql` → `data-migrations/0002-billing-plans-collections-limit.ts`
- `extras/025-hos16-deactivate-complex-plans.plan.sql` → `data-migrations/0003-hos16-deactivate-complex-plans.ts`

They were ported into the new carril, keeping their exact business logic (same
OR-PRESERVE JSONB merge semantics, same target rows).

The old `.plan.sql` files are **kept in place, not deleted**, with a `SUPERSEDED` header
comment pointing at the new migration. This is deliberate: the old file may already have run
on a live environment (staging/prod), and each carril has its own independent ledger
(`__drizzle_migrations`-style tracking for extras re-application vs. the `seed_migrations`
table for the new carril) — so on any given environment, whichever one already applied makes
the other a no-op:

- On an environment where `.plan.sql` already ran: the ported `.ts` migration's
  `NOT (limits ? key)` guard sees the key already present and updates 0 rows — a harmless
  no-op.
- On a fresh environment (or one where the extras file never ran): only the new `.ts`
  migration runs, since `.plan.sql` is idempotent-safe-guarded the same way and finds the
  keys already seeded by the current baseline fixture (dual-write in effect).

Do not delete a superseded `extras/*.plan.sql` file just because its logic moved — leave the
header marker as the historical record and let both guards keep each other honest.

### Example migrations and deterministic fixture ids

`example` fixtures (`packages/seed/src/example/`) are, per the HOS-25 OQ-1 resolution, a
valid target for a versioned data migration too — because every `example` fixture is now
assigned a **deterministic UUIDv5 id** (see `packages/seed/src/utils/deterministicFixtureId.ts`),
derived purely from its own seed-key (e.g. `accommodation:001-hotel-plaza`) rather than a
randomly-generated one. A migration can reference that exact id and know it will resolve to
the same row on every environment where the fixture was seeded, without a DB round-trip to
look it up by some other unique key first.

---

## The `destructive` flag and the production gate

Set `meta.destructive: true` when a migration deletes rows, or otherwise makes an
irreversible mutation to existing data (not: adding a new column value that could simply be
re-added later — reserve it for true one-way changes).

In `NODE_ENV=production`, any pending migration flagged `destructive: true` is refused unless
explicitly allowed:

```bash
HOSPEDA_ALLOW_DESTRUCTIVE_MIGRATION=true pnpm db:seed:migrate
# or
pnpm db:seed:migrate --allow-destructive
```

Non-destructive migrations always run, in every environment, with no gate. Outside
production (`NODE_ENV !== 'production'`), the gate never blocks anything regardless of the
flag — it exists specifically to make a human confirm a one-way prod data change, not to add
friction in dev/staging. See `packages/seed/src/data-migrations/prodGate.ts`
(`evaluateProdDataMigrationGate`).

---

## Baseline-stamp: marking a fresh DB caught up

Right after a full baseline seed (`--reset --required --example`) builds a database from
scratch, every currently-known migration is already satisfied by construction — the baseline
fixtures already reflect the post-migration end state directly, so running each migration's
`up()` for real would be redundant at best and actively wrong at worst (a migration written
against pre-migration state could fail against data that was never in that state to begin
with).

`pnpm --filter @repo/seed seed --data-migrate --baseline-stamp` records a `seed_migrations`
ledger row for every currently pending migration **without ever calling its `up()`** — mirroring
how a fresh `drizzle-kit migrate` against a schema created via `push`/init SQL leaves
`__drizzle_migrations` fully caught up without re-executing any individual structural
migration.

`pnpm db:fresh` and `pnpm db:fresh-dev` already chain this automatically after the main seed
step — you do not need to run it by hand for local dev. It is idempotent: calling it again
after everything is already stamped does nothing (no duplicate rows, no error).

---

## Production day-1: manual baseline-stamp is still required (open item)

`pnpm db:fresh`'s automatic baseline-stamp step does **not** apply to the production day-1
bootstrap path documented in
[`docs/deployment/first-time-setup.md` Phase 4](../deployment/first-time-setup.md#phase-4-database-initialization):

```bash
pnpm --filter @repo/seed seed --required --exclude=users
```

That command is a **partial** baseline — it deliberately skips `--example` and the `users`
step, unlike the full `--reset --required --example` that `db:fresh`/`db:fresh-dev` wrap
with an automatic baseline-stamp. Nothing currently baseline-stamps the migrations ledger
after this curated prod seed runs.

**Until this is automated, an operator running the production day-1 bootstrap must run the
baseline-stamp manually, right after step 4 of Phase 4 completes**:

```bash
pnpm --filter @repo/seed seed --data-migrate --baseline-stamp
```

Caveat, current as of the `0001`-`0003` migrations: this is safe **only because none of the
currently-shipped `required`-group migrations depend on the excluded `users` step** — they
all target `billing_plans` rows, which the curated seed already creates. If a future required
migration is added that depends on data the `--exclude=users` step would otherwise seed (or on
any other step a curated prod run might exclude), this assumption must be re-verified before
baseline-stamping blindly. When in doubt, run `pnpm db:seed:migrate:status` first and read
which migrations would actually apply before choosing between running them for real vs.
baseline-stamping.

---

## Common mistakes

| Mistake | Consequence | Fix |
|---------|-------------|-----|
| Edited a baseline fixture/config without adding a migration | Fresh DBs get the change, staging/prod never do | `pnpm db:seed:make <slug>` in the same PR, or add `[skip-seed-migration]: <reason>` if genuinely not needed |
| Ran `db:seed:migrate` before `db:migrate`/`db:apply-extras` | Migration referencing a new column/object fails at runtime | Always: `db:migrate` → `db:apply-extras` → `db:seed:migrate` |
| Wrote a Drizzle-invisible DB object (trigger/matview/CHECK) into `data-migrations/` | Wrong carril — not re-applied the way `extras/` objects are | Move it to `packages/db/src/migrations/extras/` |
| Deleted rows with a raw `DELETE` inside `up()` | Bypasses the FK-reference and operator-edit guards, can cascade | Use `ctx.helpers.safeDelete` |
| Forgot `destructive: true` on a migration that deletes/irreversibly mutates data | Gate never protects it in production | Set `meta.destructive: true` when scaffolding (`--destructive`) or by hand |
| Assumed `pnpm db:fresh`'s auto-baseline-stamp covers the prod day-1 seed | Migrations silently run "for real" against curated prod data (or `db:seed:migrate:status` shows a surprising pending count) | Baseline-stamp manually after the day-1 `--required --exclude=users` seed — see [above](#production-day-1-manual-baseline-stamp-is-still-required-open-item) |

---

## Reference

- [`.specs/HOS-25-versioned-seed-data-migrations/spec.md`](../../.specs/HOS-25-versioned-seed-data-migrations/spec.md) — full design record
- [`packages/seed/CLAUDE.md`](../../packages/seed/CLAUDE.md) — Seed package quick reference (Seed Data Migrations section)
- [`packages/db/CLAUDE.md`](../../packages/db/CLAUDE.md) — DB package migration carriles
- [docs/guides/migrations.md](migrations.md) — schema migration carriles (`migrations/` + `extras/`)
- [docs/deployment/first-time-setup.md](../deployment/first-time-setup.md#phase-4-database-initialization) — production day-1 bootstrap (Phase 4)
- `packages/seed/src/data-migrations/types.ts` — the full `SeedMigrationCtx`/`SeedMigrationModule` contract
- `scripts/check-seed-dual-write.sh` — CI guard implementation and design notes
