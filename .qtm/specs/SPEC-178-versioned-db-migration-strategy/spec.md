---
spec-id: SPEC-178
title: Versioned DB Migration Strategy Overhaul
type: infrastructure
complexity: high
status: in-progress
created: 2026-06-01T00:00:00Z
references:
  - ADR-017 (PostgreSQL-specific features via manual migrations — partially superseded)
  - SPEC-172 (amenity/feature name -> i18n jsonb — the conversion that exposed the gap)
  - SPEC-177 (display_order column — the collateral casualty)
  - SPEC-161 (cron observability — introduced the cronstrue import, unrelated deploy break)
---

# SPEC-178 — Versioned DB Migration Strategy Overhaul

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal.** Replace the current ad-hoc database-change mechanism with a **single, versioned, deterministic
migration system** that is applied identically across dev, CI, staging, and prod — eliminating schema/data
**drift** between environments by design, while preserving fast iteration in local dev.

**Motivation (what's broken today).** A staging deploy + a staging seed both failed on the same day. Root-cause
analysis revealed the repo has **no real migration system**:

- `db:migrate` is a **mislabeled alias of `drizzle-kit push`** (`packages/db/package.json`). There is no
  `drizzle-kit migrate` in any normal path. `migrate-production.sh` also runs `push` under the hood.
- **No journal, no generated migrations.** `packages/db/src/migrations/meta/_journal.json` does not exist;
  there are 0 generated `.sql` files. The only SQL lives in `manual/` (30 files) applied by a **separate**
  script (`apply-postgres-extras.mjs`).
- This produces **two parallel systems** — `push` (structure) and `manual/` + `apply-extras` (the rest) —
  that run in separate steps, in a fragile order. **That duality is the drift factory.**
- `push` is **non-deterministic**: it infers the diff against each DB's *current* state, so two environments
  with different histories diverge. On staging, `push` tried to cast `amenities.name` text->jsonb (SPEC-172)
  **without a `USING` clause**, errored mid-run (Postgres 42804), aborted the rest of the statements
  (including SPEC-177's `display_order` ADD COLUMN), **yet exited 0** — so `hops db-seed` reported
  "Schema synced ✓" over a broken DB, and `apply-extras` then failed at the `display_order` backfill.
- `migrate-production.sh` **does not run `apply-extras` at all**, so on prod the conversion/extras never apply
  automatically, and `push` exiting 0-on-error means prod could report SUCCESS over a half-migrated DB.

**Success criteria.**

- One migration carril is the **single source of truth**; the same migrations apply in the same order in CI,
  staging, and prod. Same migrations applied = same schema, regardless of prior state. **Drift impossible by
  design.**
- `push` is **confined to dev** (fast, disposable DB). The VPS never runs `push`.
- **Drizzle-generated structural migrations** and **hand-written Postgres extras** live in **clearly
  separated, name-distinguishable locations** — you can tell at a glance which Drizzle generated and which we
  wrote.
- A **CI gate blocks any PR** that changes the TS schema without its accompanying migration. Drift is caught
  in review, never in prod.
- A migration failure **aborts for real** (no exit-0-on-error masking) and prod takes a backup first.
- CLAUDE.md + agent instructions encode an unambiguous **"where does each change go"** protocol so every
  future contributor (human or agent) follows the same rules.

**Target users.** Developers and AI agents making schema/data changes; operators running staging/prod
migrations via `hops`.

**Decisions locked (do not re-litigate).**

- **Reset prod + staging to zero.** No real users exist yet (only early beta testers; data is disposable).
  The reset rebuilds both DBs cleanly from the current TS schema + extras + seed, and — critically — **saldas
  the entire historical migration debt** (see §6: 8 of 30 `manual/` files become obsolete on an empty DB).
  This removes the need for a delicate baseline-stamp and guarantees the first versioned state is correct.
- **Single migration carril = drizzle-kit `generate` + `migrate`**, with the journal committed to git. `push`
  is dev-only. `migrate` runs in CI/staging/prod.
- **Two physically-separated carriles, machine-enforced by directory + naming:**
  - `migrations/` — Drizzle-generated structural migrations (tables, columns, normal indexes, FKs, enums) AND
    data conversions tied to a structural change (hand-edited to add the `USING`). Numbered by Drizzle,
    journal-tracked, applied once each by `migrate`.
  - `migrations/extras/` — objects Drizzle cannot declare (materialized views, triggers, CHECK constraints,
    GIN/partial/functional indexes). Hand-written, **idempotent**, named `NNN-name.kind.sql` with a
    **3-digit numeric prefix** (`001-search-index.matview.sql`, `002-set-updated-at.trigger.sql`) so the
    `apply-extras` lexical sort honors real ordering deps; re-applied every time by `apply-extras`.
- **The golden routing rule** (goes verbatim into CLAUDE.md): *Can Drizzle declare it in the TS schema?* ->
  `migrations/`. *Is it a Drizzle-invisible object (trigger/matview/CHECK/special index/role)?* ->
  `migrations/extras/`. *Is it a data transformation of existing rows (`USING`/`UPDATE`)?* -> `migrations/`,
  by hand-editing the generated file. **`push`/`generate` NEVER convert data — conversions are always explicit
  with their `USING`.**
- **Consolidate the surviving extras.** Aprovechando el reset, collapse the evolutionary chains
  (`search_index` is split across 5 files + 1 replacement; `delete_entity_bookmarks` has 3 versions) into one
  clean idempotent file each, named `NNN-name.kind.sql` (3-digit prefix). ~21 category-A files -> ~14
  consolidated extras (gh_refresh excluded — see below).
- **Delete the 8 obsolete B/C/D files.** Git history preserves them; they are no-ops on an empty DB.
- **Drop the `gh_refresh` role** (was `manual/0021`). VERIFIED obsolete: it was a least-privilege role for a
  Vercel+Neon-era GitHub Action that refreshed the matview externally. Today the refresh runs as an in-process
  node-cron job (`apps/api/src/cron/jobs/search-index-refresh.job.ts`, every 6h, direct
  `REFRESH MATERIALIZED VIEW CONCURRENTLY` with app creds) — zero `.github/workflows` references. The role is
  NOT migrated into `extras/`; additionally a `DROP USER IF EXISTS gh_refresh` runs during reset because
  Postgres roles are cluster-wide and survive `DROP SCHEMA`. Dead script `verify-gh-refresh.mjs` deleted.
- **Re-create the 3 Postgres extensions on reset.** VERIFIED: `uuid-ossp`, `pgcrypto`, `unaccent` are only
  installed by Docker `init.sql` (first boot) + the test global-setups — NO VPS rebuild flow re-creates them.
  `DROP SCHEMA public CASCADE` drops their objects from `public`, and the schema needs `gen_random_uuid()`
  (pgcrypto). A `CREATE EXTENSION IF NOT EXISTS` preflight runs before `migrate` on every VPS rebuild.
- **`hops db-migrate` and `hops db-seed` are split.** `db-seed` keeps its current `--reset/--required/--example`
  data behavior; it gains a `--migrate` flag to run migrate first. Schema sync on the VPS = `migrate`, never
  `push`.
- **`db:migrate` alias gets fixed** to mean a real `drizzle-kit migrate`; the push command stays as `db:push`.

### 2. User Stories & Acceptance Criteria (BDD)

**US-1 — A schema change ships through one deterministic carril.**

- GIVEN a developer adds a column to the TS schema
- WHEN they run `pnpm db:generate`
- THEN a versioned migration file is produced under `migrations/` and journal-tracked
- AND applying it via `migrate` on an empty DB yields the exact schema the TS declares (round-trip test).

**US-2 — CI blocks a schema change with no migration.**

- GIVEN a PR that modifies a `*.dbschema.ts` file
- WHEN CI runs the schema-drift guard
- THEN if `drizzle-kit generate` would produce a non-empty diff (i.e. the migration is missing), the
  `guards` job FAILS with a message telling the author to run `pnpm db:generate`.

**US-3 — Staging and prod use the identical migration process.**

- GIVEN an operator runs `hops db-migrate --target=staging` and later `--target=prod`
- WHEN each runs
- THEN both apply the same versioned migrations via `drizzle-kit migrate` (not `push`), take a backup on prod,
  and **abort with a non-zero exit on any failure** (no exit-0-on-error masking).

**US-4 — Extras are re-applied and easy to locate.**

- GIVEN the `migrations/extras/` directory
- WHEN a developer looks for the `search_index` matview or a trigger
- THEN each is in its own descriptively-named idempotent file, visually distinct from Drizzle-generated
  migrations, and `apply-extras` re-applies all of them idempotently after `migrate`.

**US-5 — A data conversion preserves data with an explicit `USING`.**

- GIVEN a future column type change on a populated table
- WHEN the generated migration is reviewed
- THEN the author hand-edits it to include the `USING` clause, and a regression test proves old-format data is
  preserved through the conversion.

**US-6 — Prod + staging reset cleanly and the seed completes.**

- GIVEN the reset-to-zero rebuild on staging/prod
- WHEN `hops db-migrate` then `hops db-seed` run
- THEN the DB is built from the current schema (correct types from the start, no cast needed), extras apply,
  and the seed populates without the `name`/`display_order` failures seen on 2026-06-01.

**US-7 — An agent knows exactly what to do when touching the schema.**

- GIVEN an AI agent (or developer) tasked with a schema/data change
- WHEN they read `packages/db/CLAUDE.md`
- THEN the golden routing rule + the dev-vs-VPS table tell them unambiguously which carril to use, that
  `push` is dev-only, and that CI will block a missing migration.

### 3. UX / DX Considerations

- The developer's fast loop is **unchanged**: keep iterating with `db:push` / `db:fresh-dev` on a disposable
  local DB. The only new step is `pnpm db:generate` at the end of a schema change (the "bridge" step that
  turns dev experimentation into the formal artifact).
- Error messages: the drift guard and the VPS migrate wrapper must print **actionable** failures
  (`run pnpm db:generate`, `migration X failed — DB restored from backup at Y`).
- Naming convention makes the two carriles **self-documenting** — no need to read comments to know provenance.

### 4. Out of Scope

- Expand/contract zero-downtime migration choreography for individual future changes (documented as the
  recommended pattern for large live tables, but not built as tooling here).
- A staging<->prod live schema diff/parity command (the round-trip test + identical process already prevent
  drift; a live differ is a possible follow-up).
- Changing the seed's data model (required/example split stays as-is).
- Rewriting business logic, services, or routes. This spec is migration-infra only.
- The cronstrue ESM deploy fix (shipped separately in PR #1367; only referenced here for the CI lint-guard
  follow-up idea).

## Part 2 — Technical Analysis

### 5. Architecture — the two carriles

```
packages/db/src/migrations/
├── meta/                      # drizzle journal (NOW committed to git — today it doesn't exist)
│   └── _journal.json
├── 0000_baseline.sql          # Drizzle-generated: full current schema snapshot (post-reset baseline)
├── 0001_<change>.sql          # future structural changes (+ hand-edited USING for data conversions)
├── ...
└── extras/                    # hand-written, idempotent, re-applied every time by apply-extras
    ├── 001-search-index.matview.sql
    ├── 002-set-updated-at.trigger.sql
    ├── 003-delete-entity-bookmarks.trigger.sql
    ├── 004-billing-checks.constraints.sql
    ├── 005-conversation-partial-indexes.sql
    ├── 006-newsletter-partial-indexes.sql
    └── ... (~14 consolidated extras; gh_refresh role DROPPED, not migrated — see §6)
```

- **`migrate`** applies `migrations/*.sql` once each, in order, tracked in the journal + the
  `__drizzle_migrations` table. Deterministic, transactional per file, respects exit codes.
- **`apply-extras`** applies `migrations/extras/*.sql` (idempotent) **after** migrate, every run.
- A future change decision tree (the golden rule) keeps the two carriles cleanly partitioned.

### 6. Manual-migrations audit (evidence for the reset + carril split)

Audited all 30 `manual/*.sql` forward files. Categories:

| Cat | Meaning | Count | Fate on reset-to-zero |
|---|---|---|---|
| **A** | Pure extra (matview/trigger/CHECK/special index/role) — Drizzle-invisible | 22 | 21 **survive** -> `migrations/extras/` (consolidate to ~14); `0021` gh_refresh role **dropped** (obsolete) |
| **B** | Data conversion (`ALTER ... TYPE ... USING`) | 1 (`0029` name->jsonb) | **Obsolete** (fresh DB declares jsonb directly) -> delete |
| **C** | Structure fix already in TS schema (ADD COLUMN / drop NOT NULL / FK) | 5 (`0013,0017,0027,0028`, parts of `0011/0025/0026`) | **Obsolete** (baseline creates them) -> delete |
| **D** | Data backfill (`INSERT`/`UPDATE` existing rows) | 2 (`0024`, parts of `0025/0026`) | **Obsolete** (no legacy rows on empty DB) -> delete |

**Category-A files to preserve (consolidate):** 0001-0010, 0012, 0014-0016, 0018-0020, 0022-0023, 0030.
(`0021` gh_refresh role is dropped, not preserved — see §13 OQ-A resolution.)
Notable consolidations: `search_index` (0001-0004 + 0030 -> one file with the final 0030 definition);
`delete_entity_bookmarks` (0006/0014/0018 -> one file with the final enum-cast version + all trigger
attachments). `0011` is mixed (keep the JSONB-shape CHECKs, drop the NOT NULL-drop step). `0019` is redundant
on a fresh DB (Drizzle declares the index) — drop or keep as defensive.

### 7. The reset-to-zero rebuild

Because there are no real users, both staging and prod are rebuilt clean. Done via `hops psql` (drops the
schema *contents*, NOT the database — the DB, owner role, and connection config stay intact):

1. `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` + `DROP USER IF EXISTS gh_refresh` (roles are
   cluster-wide and survive `DROP SCHEMA`).
2. **Extensions preflight** — `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; ... "pgcrypto"; ... "unaccent";`
   (run as superuser). REQUIRED: `DROP SCHEMA` removed their `public` objects and no VPS rebuild flow
   re-creates them today; the schema needs `gen_random_uuid()` (pgcrypto).
3. `drizzle-kit migrate` applies `0000_baseline` (whole current schema incl. all 29 billing tables, correct
   types from the start — no text->jsonb cast needed, no `display_order` race).
4. `apply-extras` applies the consolidated `migrations/extras/`.
5. `hops db-seed` populates required (+ example on non-prod).

This single operation **resolves the stuck staging seed** and establishes the first deterministic baseline.
Prod reset requires the explicit typed confirmation already enforced by `hops db-seed --reset` on prod. Steps
1-2 are folded into `hops db-migrate` (or a `--reset` flag on it) so the whole rebuild is one sanctioned
command, not a manual psql session.

### 8. Tooling changes (`hops` + scripts)

- **`db:migrate` fixed** in `packages/db/package.json` -> real `drizzle-kit migrate` (not `push`). Keep
  `db:push` separate (dev-only). Add `db:generate` usage docs.
- **`migrate-production.sh` rewritten**: backup (keep) -> `drizzle-kit migrate` (real) -> `apply-extras` ->
  verify. **Abort with non-zero on any failure.** Remove the dead `drizzle-kit check` no-op.
- **New `hops db-migrate --target=staging|prod`**: applies the versioned carril (migrate + extras), separate
  from seeding, target-aware, backup-before on prod, real abort-on-fail.
- **`hops db-seed` split**: keeps `--reset/--required/--example`; **gains `--migrate`** to run `db-migrate`
  first; its internal schema step changes from `push` to `migrate` (or delegates to `db-migrate`). Staging =
  identical process to prod (`--target`).
- **`db:fresh-dev` stays on `push`** (dev only, disposable). Velocidad de desarrollo intacta.

### 9. CI / guardrails

- **Schema-drift guard** in the `guards` job (`.github/workflows/ci.yml`) — new
  `scripts/check-schema-drift.sh`: run `drizzle-kit generate` against a clean ephemeral DB (or `--check`-style
  diff) and **fail if it would emit a non-empty migration** (schema changed without a committed migration).
  Mirrors the existing 8 `bash scripts/check-*.sh` guards.
- **CI applies via `migrate`, not `push`.** `test-integration` global-setup and the E2E workflows
  (`e2e-pr.yml`, `e2e-nightly.yml`) switch from `db:push` to `migrate` + `apply-extras`, so CI exercises the
  exact prod path. A broken migration fails in CI, not prod.
- **Bonus:** wire `env:check:registry` into `ci.yml` (it's documented as a CI gate but isn't actually in CI).

### 10. Testing strategy (no tests = not done)

- **Round-trip test (the anti-drift keystone):** empty DB -> apply ALL migrations + extras -> introspect ->
  must match the TS schema. Catches any manual extra that drifted from the schema.
- **Idempotency test:** running `migrate` twice and `apply-extras` twice is a no-op the second time.
- **Conversion regression:** a representative type conversion with `USING` preserves existing data
  (reproduces the `name` text->jsonb class of bug as a guard for future conversions).
- **CI guard test:** a deliberately-uncommitted schema change makes `check-schema-drift.sh` fail (proves the
  gate works).

### 11. Dependencies

- None new. `drizzle-kit` is already present. The change is configuration + scripts + docs, not new packages.

### 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Baseline `0000` doesn't reflect real prod state | High | Reset-to-zero removes the need to match existing state — baseline IS the fresh state |
| `drizzle-kit migrate` can't express extras/conversions | Medium | Extras stay in `migrations/extras/`; conversions hand-edited into generated files with `USING` |
| Consolidating extras introduces a regression | Medium | Round-trip + idempotency tests on a fresh DB before staging reset |
| Operator runs `push` against the VPS out of habit | Medium | `db:migrate` no longer aliases push; docs + `hops db-migrate` are the only sanctioned VPS path |
| Drift guard false-positives on the manual extras tier | Medium | Guard scopes to the Drizzle schema tier only; extras are idempotent and out of journal scope |
| Reset wipes beta-tester data | Low (accepted) | Explicit decision — no real users; typed confirmation on prod reset |

### 13. Documentation & agent-instruction surface

Update every doc that describes the migration workflow so they match the new reality and tell agents what to
do:

- **`packages/db/CLAUDE.md`** — rewrite Migrations + Common Gotchas: the two carriles, the golden routing
  rule, the dev-vs-VPS table, `push` dev-only, `db:generate` is mandatory before a schema PR, the
  `migrations/extras/` convention.
- **Root `CLAUDE.md`** — fix the misleading `db:migrate` = "Apply migrations" line and the
  "`drizzle-kit push` is not enough" gotcha; point to the new flow.
- **New ADR** (supersedes the relevant parts of ADR-017) — decision record for adopting versioned migrations
  + the two-carril model + reset rationale.
- **`docs/guides/migrations.md`** — currently out of sync (describes an aspirational migrate flow that was
  never used). Rewrite to the actual new flow.
- **"Rules for agents touching the schema"** — an explicit, copy-pasteable protocol in `packages/db/CLAUDE.md`
  AND surfaced to delegated sub-agents (e.g. `db-drizzle-engineer`) in their prompts:
  1. Iterate freely in dev with `push` / `fresh-dev`.
  2. At close: `pnpm db:generate`, review the file.
  3. Data conversion? Hand-edit the `USING` (Drizzle won't invent it).
  4. Never `push` against the VPS. Ever.
  5. CI will block a missing migration — it's not optional.

## Implementation Approach (phases)

1. **foundations** — Fix the `db:migrate` alias; adopt `generate`+`migrate`; commit the journal; generate the
   `0000` baseline (incl. all 29 billing tables); split `manual/` into consolidated `NNN-name.kind.sql`
   `migrations/extras/` (21 category-A) and delete the 8 obsolete B/C/D files + the `0021` gh_refresh role +
   the dead `verify-gh-refresh.mjs`; reset prod+staging to zero via `hops psql`
   (`DROP SCHEMA ... CASCADE` + `DROP USER gh_refresh` + `CREATE EXTENSION` preflight).
2. **tooling** — Rewrite `migrate-production.sh` (real migrate + extras + abort-on-fail + backup); add
   `hops db-migrate --target`; split `hops db-seed` (keep data flags, add `--migrate`, swap push->migrate);
   ensure staging==prod process parity. Keep `db:fresh-dev` on push.
3. **ci** — `scripts/check-schema-drift.sh` + wire into the `guards` job; switch `test-integration` +
   E2E workflows from `push` to `migrate`+`apply-extras`; wire `env:check:registry` into CI.
4. **testing** — round-trip (empty -> migrate+extras -> introspect == TS schema), idempotency, conversion
   regression, and a drift-guard self-test.
5. **docs + agent-rules** — rewrite `packages/db/CLAUDE.md`, root `CLAUDE.md`, `docs/guides/migrations.md`;
   new ADR; the "Rules for agents touching the schema" protocol surfaced to sub-agents.

## Internal Review Notes

- **Reset-to-zero is the pivotal simplifier.** It removes baseline-stamp risk AND saldas the historical
  migration debt in one move. Confirmed disposable (no real users, only beta testers).
- **The carril split is machine-enforced** (directory + naming), satisfying the explicit ask: "saber fácil
  cuáles generó Drizzle y cuáles escribimos nosotros."
- **Open questions — RESOLVED 2026-06-01 (decisions + evidence):**
  - **OQ1 (extras ordering) — RESOLVED:** use `NNN-name.kind.sql` (3-digit prefix). `apply-extras` sorts
    lexically and real cross-file ordering deps exist, so an explicit numeric prefix beats relying on
    descriptive-name sort.
  - **OQ-A (gh_refresh) — RESOLVED: DROP it.** VERIFIED obsolete — a Vercel+Neon-era role for a GitHub Action
    that no longer exists; the matview refresh is now an in-process node-cron job
    (`apps/api/src/cron/jobs/search-index-refresh.job.ts`) using app creds, zero `.github/workflows` refs. Not
    migrated to `extras/`; `DROP USER IF EXISTS gh_refresh` added to reset (cluster-wide role survives
    `DROP SCHEMA`); delete the dead `verify-gh-refresh.mjs`.
  - **OQ2 (reset method) — RESOLVED:** `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` via `hops psql`
    (drops contents, keeps the DB). MUST be followed by a `CREATE EXTENSION IF NOT EXISTS` preflight — VERIFIED
    no VPS rebuild flow re-creates `uuid-ossp`/`pgcrypto`/`unaccent`, and the schema needs `gen_random_uuid()`.
    Folded into `hops db-migrate`.
  - **OQ3 (drift guard) — RESOLVED:** `drizzle-kit generate` is offline (diffs vs the journal snapshot, no DB);
    the guard runs `generate` and fails on a non-empty `git diff` of `migrations/`. Only the non-interactive
    rename-prompt behavior needs validating in impl.
  - **OQ4 (billing in baseline) — RESOLVED: YES, include all 29 billing tables.** VERIFIED
    `src/billing/schemas.ts` is a pure re-export of `@qazuor/qzpay-drizzle` (schema-as-library: `pgTable`
    objects + storage adapter, ZERO migrations). Drizzle owns the DDL for the 24 qzpay tables + 5 repo-owned
    billing tables; FK ordering resolved topologically. No conflicting qzpay mechanism.
- **No external services involved** (no web-doc verification needed); all facts grounded in the repo audit.
