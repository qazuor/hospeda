# ADR-029: Versioned Migration Strategy (generate + migrate + two carriles)

## Status

Accepted (2026-06-01)

**Supersedes**: the migration-related portions of [ADR-017](ADR-017-postgres-specific-features.md)
(specifically the 2026-04-18 note that stated "this repository does NOT use `drizzle-kit migrate`
and schema synchronization is done with `drizzle-kit push`"). ADR-017 remains the reference for
which PostgreSQL objects are Drizzle-invisible and why they require an extras script.

## Context

Until SPEC-178, the repo used `drizzle-kit push` as the only schema synchronization mechanism.
This worked during early development (no production users, schema churn, full rebuilds acceptable)
but left the project without a migration history, a drift guard, or a safe path to apply schema
changes to a live database.

SPEC-178 resolved the migration debt by generating a single consolidated baseline
(`packages/db/src/migrations/0000_baseline.sql`) from the current schema and switching to the
versioned carril going forward. The historical push-only era is captured in that baseline; the
journal is now the source of truth for all subsequent changes.

The key constraints driving the design:

1. **No production data to protect** — the platform had no real users at cut-over. This made a
   reset-to-zero approach acceptable and eliminated the need for a complex baseline migration ladder.
2. **Drizzle has a hard boundary** — four categories of PostgreSQL objects (materialized views,
   triggers, CHECK constraints with function calls, functional/JSONB indexes) cannot be expressed in
   the Drizzle schema DSL. They need a separate mechanism regardless of whether we use push or migrate.
3. **Drift detection gap was a real risk** — `push` silently accepts a TS schema change without
   creating a record of what changed or when, making it impossible to apply the same change to a
   second environment reproducibly.

## Decision

### Single versioned carril for structural changes

The canonical path for schema changes is:

```
TS schema change → db:generate → review .sql → commit both → db:migrate on VPS
```

- `pnpm db:generate` produces a `.sql` file in `packages/db/src/migrations/`.
- The file and its journal entry (`src/migrations/meta/_journal.json`) are committed to git.
- `pnpm db:migrate` (real `drizzle-kit migrate`) applies all pending files once, in order.
- `db:push` is **dev-only** — it must never be run against the VPS.

### Two physically separate carriles

The directory structure enforces the boundary:

| Directory | Contents | Applied by | Frequency |
|-----------|----------|------------|-----------|
| `src/migrations/*.sql` | Drizzle-generated structural migrations + hand-edited data conversions (USING) | `db:migrate` | Once per file, journal-tracked |
| `src/migrations/extras/NNN-name.kind.sql` | Drizzle-invisible objects (triggers, matviews, CHECK, special indexes) | `db:apply-extras` | Every time (idempotent) |

Files in `extras/` carry a 3-digit numeric prefix for deterministic ordering and must be
idempotent (`IF NOT EXISTS` / `CREATE OR REPLACE` throughout).

### Data conversions always explicit

`push` and `generate` never write `USING` expressions for type-cast conversions. When a column
type change requires a data migration (e.g. casting `text` to an enum), the developer hand-edits
the generated `.sql` to add the `USING` before committing.

### push stays for dev only

`db:fresh-dev` still uses push because local dev DBs are disposable. This is intentional: push
is fast, requires no journal management, and works correctly when the DB is always rebuilt from
scratch.

| Environment | Command | Notes |
|-------------|---------|-------|
| Local dev | `db:fresh-dev` (push + seed) | Disposable DB, fast iteration |
| CI / VPS | `hops db-migrate --target=staging\|prod` | Real migrate + apply-extras, pg_dump backup |

### Reset-to-zero rationale

A `--reset` path (`scripts/reset/000-reset-schema.sql` + `001-extensions.sql`) is provided for
wiping and rebuilding a VPS environment. `prod --reset` requires typed confirmation at the CLI.
This is safe given no production user data exists at the time of this ADR's adoption.

After any `DROP SCHEMA public CASCADE` (which the reset script issues), extensions must be
re-installed from `001-extensions.sql` before `migrate` is run. The baseline uses `gen_random_uuid()`
(pgcrypto); skipping this step causes the migrate to fail.

### Drift guard

`scripts/check-schema-drift.sh` runs `drizzle-kit generate` offline and fails if the TS schema
has diverged from the committed migrations. This is the CI gate that enforces the protocol.

CI wiring is deferred to the new local-runner CI system (see
`.qtm/specs/SPEC-178-versioned-db-migration-strategy/ci-wiring-handoff.md`).

## Consequences

### Positive

- **Reproducible deploys** — every environment applies the same ordered sequence of SQL files.
  "It works in staging" is now a meaningful guarantee.
- **Drift detection** — the guard catches missing migrations before they reach a PR review.
- **Clear audit trail** — every structural change has a timestamped, reviewable SQL file in git.
- **Extras are still idempotent and re-run friendly** — the two-carril model lets Drizzle-invisible
  objects be refreshed after any schema reset without friction.
- **Dev speed preserved** — push + fresh-dev still gives instant local iteration with no migration
  bookkeeping.

### Negative

- **Extra step before schema PRs** — developers must run `db:generate` and review the output
  before opening a PR. Forgetting it means CI fails.
- **Data conversions are manual** — the `USING` expression in a type-cast migration must be
  hand-written. Drizzle won't generate it, and an incorrect `USING` can corrupt data.
- **Reset is destructive** — the `--reset` flow drops all objects. It is gated behind a
  confirmation prompt for prod, but the risk exists.

### Neutral

- The `search_index` materialized view refresh is unchanged: still called by the cron job.
- Integration tests continue to use push (via the test global-setup) for the isolated
  `hospeda_integration_test` database — this is intentional and correct for that use case.

## Developer Protocol (5 steps)

All agents and developers touching `packages/db/src/schemas/` MUST follow this protocol:

1. Iterate freely in dev with `push` / `db:fresh-dev`.
2. At close: run `pnpm --filter @repo/db db:generate` and review the generated file.
3. Data conversion needed? Hand-edit the generated `.sql` to add the `USING` expression.
4. Never run `push` against the VPS. Ever.
5. CI's drift guard blocks a missing migration — it is not optional.

## Alternatives Considered

### Keep push-only indefinitely

Viable only while the DB has no production users. As soon as real user data exists, push against
a live environment destroys data and is irreversible. Rejected.

### Use Flyway or Liquibase alongside Drizzle

These tools handle triggers and materialized views natively but would introduce a second migration
engine. The team already uses Drizzle for type-safe query building; adding a second tool doubles
the ops surface. Rejected (see ADR-017 for the earlier evaluation).

### Generate a migration ladder from historical pushes

Reconstructing 28+ months of push history into an ordered migration ladder was evaluated and
rejected: the effort is large, the result is untestable, and there are no production users to
protect. The consolidated baseline approach is simpler and equally correct.
