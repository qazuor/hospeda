# ADR-017: PostgreSQL-Specific Features via Manual Migrations

## Status

Accepted

## Context

The Hospeda platform uses Drizzle ORM as its database abstraction layer (see ADR-004). Drizzle's
schema declaration system covers the vast majority of PostgreSQL features: tables, columns, indexes,
foreign keys, enums, and partial indexes. However, three categories of PostgreSQL features cannot be
expressed in Drizzle schema files and are therefore **invisible to `drizzle-kit push` and
`drizzle-kit generate`**:

1. **Materialized views** — Drizzle has no first-class API for `CREATE MATERIALIZED VIEW`.
2. **Triggers and trigger functions** — Drizzle does not support `CREATE TRIGGER` or
   `CREATE OR REPLACE FUNCTION ... RETURNS TRIGGER`.
3. **Expression-based CHECK constraints using database functions** — While Drizzle 0.30+ added a
   `.check()` builder for simple column constraints, constraints that call PostgreSQL functions
   (e.g., `jsonb_typeof()`) cannot be expressed through the Drizzle schema DSL and are dropped
   silently when Drizzle regenerates a table.

This creates a correctness gap: a developer who runs `drizzle-kit push` or generates a fresh
database from schemas alone will have a structurally incomplete database that is missing critical
runtime behavior.

## Decision

We manage all three feature categories exclusively through **manual SQL migration files** stored in
`packages/db/src/migrations/manual/` (for triggers and materialized views) and
`packages/db/src/migrations/` (for constraint migrations numbered in sequence).

Additionally, we provide a shell script `packages/db/scripts/apply-postgres-extras.sh` that
consolidates all of these manual migrations into a single idempotent command. This script must be
run after any `drizzle-kit push` or after applying Drizzle-generated migrations on a fresh database.

Where Drizzle supports a constrained form of `.check()` (simple IN-list constraints without
function calls), we annotate the schema column with a JSDoc comment referencing the migration that
applies the actual constraint, so the intent is visible even though Drizzle cannot enforce it.

## Affected Features

### Materialized View: `search_index`

| Artifact | Migration file |
|----------|---------------|
| Materialized view definition (UNION of accommodations, destinations, events, posts) | `manual/0016_create_search_index.sql` |
| GIN index `idx_search_index_tsv` on the `tsv` column | `manual/0017_create_search_index_gin.sql` |
| `refresh_search_index()` PL/pgSQL function (called nightly via pg_cron or manually) | `manual/0018_refresh_search_index_function.sql` |

### Triggers

| Artifact | Migration file |
|----------|---------------|
| `set_updated_at()` function + `trg_set_updated_at_*` triggers on all tables with an `updated_at` column | `manual/0019_add_generic_updated_at_trigger.sql` |
| `delete_entity_bookmarks()` function + `trg_delete_bookmarks_on_*` triggers on accommodations, destinations, events, user, posts | `manual/0020_add_delete_entity_bookmarks_trigger.sql` |

### CHECK Constraints on `billing_addon_purchases`

| Constraint name | Column(s) | Migration file |
|-----------------|-----------|---------------|
| `billing_addon_purchases_status_check` | `status` | `0025_addon_purchases_status_check.sql` |
| `chk_limit_adjustments_type` | `limit_adjustments` | `0026_addon_purchases_jsonb_check.sql` |
| `chk_entitlement_adjustments_type` | `entitlement_adjustments` | `0026_addon_purchases_jsonb_check.sql` |

## Consequences

### Positive

- **All runtime constraints live in SQL** .. triggers, functions, and CHECK constraints are
  expressed in plain SQL that is readable, reviewable, and version-controlled exactly like any other
  migration.
- **Idempotent recovery script** .. `apply-postgres-extras.sh` uses `IF NOT EXISTS` and
  `CREATE OR REPLACE` throughout, so it is safe to run multiple times and after any schema reset.
- **Clear schema intent** .. JSDoc annotations on affected Drizzle columns document which migration
  applies the database-side constraint, so the reader is never left guessing.
- **No Drizzle upgrade risk** .. we do not rely on any unstable or version-specific Drizzle `.check()`
  API for constraints that involve PostgreSQL function calls.

### Negative

- **Extra step after schema push** .. developers who run `drizzle-kit push` without subsequently
  running `apply-postgres-extras.sh` will have a structurally incomplete database. This is a
  process risk, not a tooling risk.
- **Drift detection gap** .. `drizzle-kit diff` will never report these features as drift because it
  has no knowledge of them. Schema correctness is the developer's responsibility.
- **Trigger attachment is dynamic** .. `0019` uses a `DO $$` block to attach triggers to all tables
  that have an `updated_at` column at migration time. Tables added after that migration is first
  applied will not automatically get the trigger; the script must be re-run.

### Neutral

- The `search_index` materialized view must be refreshed periodically. The `refresh_search_index()`
  function is called by the API's cron job scheduler; it is not triggered automatically.

## Developer Workflow

After any of the following operations, run `apply-postgres-extras.sh`:

```bash
# 1. After drizzle-kit push (schema development)
pnpm db:fresh-dev
packages/db/scripts/apply-postgres-extras.sh

# 2. After a fresh migration sequence
pnpm db:migrate
packages/db/scripts/apply-postgres-extras.sh

# 3. Verify the script is safe to re-run
packages/db/scripts/apply-postgres-extras.sh  # idempotent
```

See `packages/db/docs/triggers-manifest.md` for the full reference of all triggers, functions,
materialized views, and CHECK constraints managed this way.

## Alternatives Considered

### Declare everything in Drizzle `.check()`

Drizzle 0.30+ supports `.check()` in the table builder for simple expressions. However:

- It does not support expressions that call PostgreSQL functions (e.g., `jsonb_typeof()`).
- It does not support `CREATE MATERIALIZED VIEW` or `CREATE TRIGGER` at all.
- Using `.check()` for the `status` IN-list would mean the constraint is regenerated on every
  `drizzle-kit generate` run, potentially creating duplicate migration entries.

We opted to keep all three categories in manual migrations for consistency.

### Use a migration framework that supports triggers (e.g., Flyway, Liquibase)

These tools support triggers and materialized views but would replace Drizzle entirely as the
migration driver. The team evaluated this and decided the operational cost of maintaining two
migration tools outweighs the benefit.

### Embed SQL in application startup code

Running `CREATE OR REPLACE FUNCTION` statements at API boot time is fragile, couples database
schema management to application runtime, and makes it harder to audit what changed and when.
Manual migrations with version numbers provide a clear audit trail.
