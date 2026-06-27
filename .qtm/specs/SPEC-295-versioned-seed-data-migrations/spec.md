---
specId: SPEC-295
title: Versioned Seed Data Migrations
type: feat
complexity: high
status: draft
created: 2026-06-27
tags: [seed, db, migrations, devops, billing, data-integrity]
---

# SPEC-295 — Versioned Seed Data Migrations

> Make seed data evolvable on a **live** database the same way schema changes are:
> versioned, ordered, one-shot, ledgered. "Drizzle, but for data."

## 1. Summary

Today the seed system can only build a database **from scratch**
(`pnpm db:seed --reset` → `TRUNCATE … RESTART IDENTITY CASCADE` → reinsert
everything). It **cannot** be re-run against an already-seeded staging/prod
database to apply an incremental change (add a new amenity, rename a feature,
remove a deprecated catalog entry) without wiping or crashing. Any change to
canonical (`required`) data that needs to reach a live environment has to be
hand-written as an ad-hoc `extras/` SQL data-migration, which is error-prone and
off the seed's radar.

This spec introduces a **versioned data-migration carril for seed data**: numbered,
one-shot TypeScript modules tracked in a dedicated `seed_migrations` ledger, run in
order by a new `db:seed:migrate` command. Each module runs exactly once per
environment and is recorded, identically to how Drizzle migrations work for schema.
It covers **both** `required` (prod + staging) and `example` (staging) data.

## 2. Problem — why the seed is not incremental today

Investigation of `packages/seed/` surfaced **three coexisting, inconsistent
idempotency regimes** and one structural failure:

1. **Factory seeders** (`createSeedFactory`, backs amenities/features/attractions/
   destinations/**users**) call `service.create()` **blindly** — no exists-check.
   On a live DB they hit the unique constraint (slug/email) and **throw**.
2. **Older model-direct seeders** (`systemUser.seed.ts`, `billingPlans.seed.ts`)
   are idempotent via **select-then-skip**, and `billingPlans` even has a
   field-level **divergence engine** (SPEC-211 Model C: capability fields sync from
   config, commercial fields preserve operator edits).
3. **Newer seeders** (`gastronomies`, `aiPrompts`) are idempotent via
   `onConflictDoNothing`.

**The structural failure:** on a populated DB, a non-`--reset` run reaches the
**required users factory seeder** (which has no guard) *before* the (idempotent)
billing seeders, throws on the existing `admin@hospeda.com` email, and — because
`continueOnError` defaults to `false` — **aborts the whole run before billing
executes**. This is exactly why live billing changes had to ship as `extras/`
data-migrations (confirmed by the `seed-not-incremental-on-live-db` memory).

Net: there is **no reliable, repeatable way to evolve seed data on a live DB**.

### Key files (current system)

- Orchestrator: `packages/seed/src/index.ts` (`runSeed`)
- CLI + safety gates: `packages/seed/src/cli.ts` (`evaluateProdCleanupGate`)
- Factory (non-idempotent core): `packages/seed/src/utils/seedFactory.ts`
- Reset / TRUNCATE: `packages/seed/src/utils/dbReset.ts`
- Idempotency gold standard: `packages/seed/src/required/billingPlans.seed.ts`
- Manifests: `packages/seed/src/manifest-required.json`, `manifest-example.json`

## 3. Conceptual model (owner-decided)

The owner locked the following architecture (2026-06-27):

### 3.1 Versioned data-migrations + ledger (NOT declarative reconcile)

Discrete, **numbered, one-shot** data-change modules, tracked in a
`seed_migrations` ledger. Each runs **once** per environment, in order. This is the
Drizzle model applied to data, chosen over a stateless declarative "reconcile to
desired state" because the owner wants **explicit control over every destructive
and complex transformation**, not an opaque diff.

```
packages/seed/src/data-migrations/
  0001-add-wifi-amenity.ts        [applied]
  0002-rename-pool-amenity.ts     [applied]
  0003-remove-legacy-feature.ts   [pending]
```

### 3.2 Two layers (baseline + deltas), with **dual-write**

The existing **baseline seed** (the 110 amenity / 88 attraction / 26 destination
JSON files, billing TS constants, etc.) stays as the source for **fresh** databases
— it is the "current full desired state", equivalent to `schema.ts`. The new
**data-migrations** are the **deltas** that bring **already-seeded live** DBs
forward, equivalent to the `drizzle/0001.sql` files.

When a feature changes seed data, the author **edits both**:

1. The baseline catalog (so a fresh DB is built correct and fast).
2. A new numbered data-migration (so live DBs get the same delta).

On a **fresh** DB (`db:fresh`), after the baseline seed runs, **all** existing
data-migrations are **stamped as applied** (their effect is already in the
baseline). On a **live** DB, only **pending** data-migrations run. This is exactly
the `schema.ts` + generated-migration discipline the team already uses — same
mental model, same dual-write cost.

### 3.3 Deletion: hard-delete with FK guards

When a data-migration removes a record:

- **0 active FK references AND the record was not operator-edited** → **physical
  DELETE**.
- **otherwise** → **SKIP + warning** (never cascade, never silently orphan).

This keeps "final state = exact seed intent" while refusing to break referential
integrity on a live prod DB. The author writes the delete intent in the migration;
the shared guard helper enforces the safety check at run time.

### 3.4 Scope: both `required` and `example`

Both data groups go through the versioned carril. **Caveat (see Risks / OQ-1):**
`example` is Faker-random with **no stable IDs** today, so a delta cannot target a
specific example record. Making `example` **deterministic** (seeded Faker + stable
IDs) is a **hard prerequisite** for versioning it — tracked as the spec's primary
risk and resolved in tech-analysis.

## 4. Goals

- **G-1** A `seed_migrations` **ledger table** (structural migration via
  `db:generate`/`db:migrate`) recording `id`, `name`, `appliedAt`, `checksum`,
  `group` (`required` | `example`), and result.
- **G-2** A `data-migrations/` carril of numbered, **one-shot** TS modules with a
  uniform RO-RO contract (`up({ db, models, services, helpers })`), run **in
  order**, each inside a **transaction**, recorded in the ledger.
- **G-3** New commands: `db:seed:migrate` (run pending), `db:seed:migrate:status`
  (show applied/pending), `db:seed:make <slug>` (scaffold the next numbered file),
  and a **baseline stamp** path used by `db:fresh` to mark all migrations applied.
- **G-4** A shared **hard-delete-with-guards** helper: introspect active FK refs +
  detect operator edits; delete only when safe, else skip + structured warning.
- **G-5** **Idempotent + safe re-runs**: re-running `db:seed:migrate` is a no-op
  when nothing is pending; a failed migration rolls back its own transaction and
  aborts the run (no partial ledger entry).
- **G-6** **Prod safety gate**: destructive data-migrations require an explicit
  confirmation/flag in prod (extend the existing `evaluateProdCleanupGate` pattern).
- **G-7** Cover **both** `required` and `example` (the latter gated on the
  determinism prerequisite, OQ-1).
- **G-8** Author docs: how to write a data-migration, the dual-write rule, the
  run order vs schema migrations, and the relationship to the `extras/` carril.

## 5. Non-Goals

- **Not** rewriting the existing baseline catalog (the 224 JSON files) into numbered
  migrations. The baseline stays; deltas are additive.
- **Not** changing the schema-migration carril (`drizzle-kit` + `extras/`). This is a
  parallel **data** carril that runs *after* schema migrations.
- **Not** a generic declarative reconcile / diff engine (explicitly rejected by the
  owner in favor of versioned deltas).
- **Not** retrofitting every existing seeder to be idempotent in-place — the
  incremental path is the new carril, not the baseline run.
- **Not** introducing rollback/`down()` migrations unless OQ-4 decides otherwise
  (default: forward-only, like Drizzle).

## 6. Technical design (high level)

### 6.1 Ledger table

`seed_migrations` — new table via the structural carril (`pnpm db:generate` →
`db:migrate`). Columns (final shape in tech-analysis): `name` (PK, the numbered
filename), `group` (`required`/`example`), `checksum`, `applied_at`, `duration_ms`,
`result`. Mirrors `__drizzle_migrations`; preserved by `dbReset` (never truncated)
the same way `drizzle_migrations` is.

### 6.2 Data-migration module contract (RO-RO)

```ts
export const meta = { name: '0003-remove-legacy-feature', group: 'required' } as const;

export async function up({ db, models, services, helpers }: SeedMigrationCtx): Promise<SeedMigrationResult> {
  // additive / modify: use models or the divergence-style upsert
  // destructive: helpers.safeDelete({ table, where, reason })  // FK-guarded
}
```

- Runs inside a **transaction**; throw → rollback → run aborts (no ledger row).
- `up` is **forward-only** by default (OQ-4).
- Author writes intent; **`helpers.safeDelete`** centralizes the FK-guard +
  operator-edit check so no migration hand-rolls deletion safety.

### 6.3 Runner

- `db:seed:migrate` — scan `data-migrations/`, diff against the ledger, run pending
  in filename order, record each on success.
- `db:seed:migrate --baseline-stamp` — mark **all** present migrations applied
  without running them (invoked by `db:fresh` after the baseline seed).
- `db:seed:migrate:status` — print applied vs pending.
- `db:seed:make <slug>` — scaffold `NNNN-<slug>.ts` with the next number + `meta`.

### 6.4 Run order (critical)

`db:migrate` (schema) → `db:apply-extras` (drizzle-invisible objects) →
`db:seed:migrate` (data deltas). A data-migration that depends on a new column must
be ordered **after** the schema migration that adds it — enforced by the carril
order, documented in the guide.

### 6.5 Operator-edit detection (OQ-2)

The FK guard's "was it operator-edited?" check needs a provenance signal. Candidate
mechanisms (decided in tech-analysis): a `seeded`/`managed_by_seed` marker column,
or an `updatedAt > seededAt` heuristic, or the SPEC-211 Model-C capability-vs-
commercial field split reused as the policy. This is the most uncertain sub-design.

### 6.6 `db:fresh` / reset integration

`dbReset` adds `seed_migrations` to its preserve list. `db:fresh` runs baseline seed
then `--baseline-stamp`, so a brand-new dev DB ends with **every** data-migration
marked applied and **zero** pending — identical to how a fresh `db:migrate` leaves
the schema current.

## 7. Risks

- **R-1 (primary) — `example` is non-deterministic.** Versioned deltas need stable
  target IDs; today `example` is Faker-random. Making it deterministic is a
  prerequisite and a non-trivial refactor (OQ-1). Until then `example` versioning is
  blocked and only `required` ships.
- **R-2 — operator-edit detection is fuzzy.** Without a clean provenance marker, the
  guard may either over-protect (skip legit updates) or under-protect (overwrite
  operator edits). OQ-2.
- **R-3 — hard-delete on live prod is dangerous by nature.** The FK guard is the
  only thing between a delta and a referential break; it must introspect **all**
  inbound FKs, not a hand-maintained list.
- **R-4 — two data carriles (`extras/` SQL vs `data-migrations/` TS).** Risk of
  confusion about which to use. The guide must draw a crisp line (OQ-3): likely
  `extras/` for pure-SQL DB-object concerns, `data-migrations/` for catalog/seed
  data going forward, with billing's existing `extras/` data-migrations as the
  precedent to either absorb or coexist with.
- **R-5 — dual-write drift.** Author edits the migration but forgets the baseline
  (or vice-versa); a fresh DB and a live DB diverge. A CI check (baseline vs
  replayed-migrations parity) may be needed — scope in tech-analysis.

## 8. Open Questions (for tech-analysis / owner)

- **OQ-1** — `example` determinism: seeded Faker + stable IDs as the prerequisite,
  or descope `example` to "re-runnable without crashing" (no targeted deltas) for
  v1? **Owner decision needed.**
- **OQ-2** — operator-edit provenance: marker column vs `updatedAt`-heuristic vs
  reuse Model-C field split. (tech-analysis, may need owner input.)
- **OQ-3** — relationship to the existing `extras/` data-migration carril: supersede,
  absorb billing's precedent, or coexist with a documented boundary?
- **OQ-4** — forward-only (Drizzle-style) or support `down()` reversal? Default:
  forward-only.
- **OQ-5** — ledger granularity: one row per migration file (recommended) vs per
  logical change; and where `group` (`required`/`example`) gates execution.
- **OQ-6** — prod destructive-gate UX: a per-migration `destructive: true` flag in
  `meta` requiring an explicit `--allow-destructive` in prod?

## 9. Relationship to existing systems

- **Drizzle schema migrations** — the direct analogue. This carril runs *after* them.
- **`extras/` carril** — hand-written idempotent SQL for Drizzle-invisible objects
  (triggers, matviews, CHECK). Billing already (ab)uses it for **data** migrations
  because the seed couldn't do incremental data. SPEC-295 gives data its own proper
  carril; OQ-3 decides the boundary.
- **`billingPlans.seed.ts` divergence engine (SPEC-211 Model C)** — the proven
  capability-vs-commercial upsert policy; a ready template for OQ-2 and for
  modify-type data-migrations.

## 10. Revision History

- 2026-06-27 — Initial draft (allocated SPEC-295). Architecture locked with the owner
  in the originating session: (1) versioned data-migrations + ledger over declarative
  reconcile; (2) hard-delete with FK guards; (3) dual-write baseline + deltas
  (Drizzle-style); (4) scope = both `required` and `example`. Six open questions
  (OQ-1..6) deferred to tech-analysis, with `example` determinism (OQ-1/R-1) flagged
  as the primary prerequisite.
