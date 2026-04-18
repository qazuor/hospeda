# ADR-017: PostgreSQL-Specific Features via Manual Migrations

## Status

Accepted (revised 2026-04-18)

## Context

The Hospeda platform uses Drizzle ORM as its database abstraction layer (see ADR-004). Drizzle's
schema declaration system covers the vast majority of PostgreSQL features: tables, columns, indexes,
foreign keys, enums, and partial indexes. However, four categories of PostgreSQL features cannot be
expressed in Drizzle schema files and are therefore **invisible to `drizzle-kit push` and
`drizzle-kit generate`**:

1. **Materialized views** — Drizzle has no first-class API for `CREATE MATERIALIZED VIEW`.
2. **Triggers and trigger functions** — Drizzle does not support `CREATE TRIGGER` or
   `CREATE OR REPLACE FUNCTION ... RETURNS TRIGGER`.
3. **Expression-based CHECK constraints using database functions** — While Drizzle 0.30+ added a
   `.check()` builder for simple column constraints, constraints that call PostgreSQL functions
   (e.g., `jsonb_typeof()`, `char_length()`) cannot be expressed through the Drizzle schema DSL and
   are dropped silently when Drizzle regenerates a table.
4. **Functional and JSONB-extraction indexes** — Unique partial indexes over JSONB-extracted values
   (`metadata->>'idempotencyKey'`) cannot be declared through Drizzle.

This creates a correctness gap: a developer who runs `drizzle-kit push` or generates a fresh
database from schemas alone will have a structurally incomplete database that is missing critical
runtime behavior.

## Decision

We manage all four feature categories exclusively through **manual SQL migration files** stored in
a single location: `packages/db/src/migrations/manual/`. Each file is an idempotent SQL script
(using `IF NOT EXISTS`, `CREATE OR REPLACE`, and `DO` blocks with existence checks).

A shell script `packages/db/scripts/apply-postgres-extras.sh` acts as a **generic orchestrator**:
it iterates every `manual/*.sql` file in lexical order and applies it with
`psql --file --single-transaction`. Files matching `*_down.sql` are skipped automatically — those
are reversal scripts applied only through ad-hoc rollback procedures.

The script is wrapped by the root `pnpm db:apply-extras` command, which is chained automatically
into `db:fresh`, `db:fresh-dev`, and `db:reset`. Developers never need to invoke the script manually
after a standard workflow command.

**Note on Drizzle-generated migrations (2026-04-18 revision)**: this repository does NOT use
`drizzle-kit migrate`. Schema synchronization is done with `drizzle-kit push` (dev) and no
migration files are maintained under `packages/db/src/migrations/` root. The only migration files
that ship with the repository live under `manual/` and are orchestrated by the script above.

Where Drizzle supports a constrained form of `.check()` (simple IN-list constraints without
function calls), we annotate the schema column with a JSDoc comment referencing the migration that
applies the actual constraint, so the intent is visible even though Drizzle cannot enforce it.

## Affected Features

All manual migration files live under `packages/db/src/migrations/manual/` and are applied in
lexical order by the orchestrator.

### Materialized View: `search_index`

| Artifact | Migration file |
|----------|---------------|
| Materialized view definition (UNION of accommodations, destinations, events, posts) | `manual/0001_search_index_materialized_view.sql` |
| GIN index `idx_search_index_tsv` on the `tsv` column | `manual/0002_search_index_gin_index.sql` |
| UNIQUE index `idx_search_index_entity_unique (entity_type, entity_id)` (enables `REFRESH CONCURRENTLY`) | `manual/0003_search_index_entity_unique_index.sql` |
| `refresh_search_index()` PL/pgSQL function (called by API cron; see `packages/api/src/cron/`) | `manual/0004_refresh_search_index_function.sql` |

### Triggers

| Artifact | Migration file |
|----------|---------------|
| `set_updated_at()` function + `trg_set_updated_at_*` triggers on every table with an `updated_at` column | `manual/0005_set_updated_at_trigger.sql` |
| `delete_entity_bookmarks()` function + `trg_delete_bookmarks_on_*` triggers on accommodations, destinations, events, users, posts | `manual/0006_delete_entity_bookmarks_trigger.sql` |

### CHECK Constraints

| Constraint name | Table / column | Migration file |
|-----------------|----------------|----------------|
| `billing_addon_purchases_status_check` | `billing_addon_purchases.status` | `manual/0007_billing_addon_purchases_status_check.sql` |
| `chk_limit_adjustments_type` | `billing_addon_purchases.limit_adjustments` | `manual/0008_billing_addon_purchases_jsonb_checks.sql` |
| `chk_entitlement_adjustments_type` | `billing_addon_purchases.entitlement_adjustments` | `manual/0008_billing_addon_purchases_jsonb_checks.sql` |
| `billing_subscription_events_event_type_check` | `billing_subscription_events.event_type` (non-empty, length ≤ 100) | `manual/0010_billing_subscription_events_event_type_check.sql` |

### Functional / JSONB Indexes

| Index name | Expression | Migration file |
|------------|------------|----------------|
| `idx_notification_log_idempotency_key` | UNIQUE on `billing_notification_log.metadata->>'idempotencyKey'` WHERE key IS NOT NULL | `manual/0009_notification_log_idempotency_index.sql` |

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

The orchestrator is chained automatically into the primary schema commands, so most of the time you
do not need to invoke it manually:

```bash
pnpm db:fresh-dev   # drop + push + apply-extras + seed  (dev default)
pnpm db:fresh       # drop + generate + migrate + apply-extras + seed
pnpm db:reset       # drop + migrate + apply-extras
```

For ad-hoc or CI usage you can invoke it directly:

```bash
pnpm db:apply-extras                                          # resolves URL from env or apps/api/.env.local
packages/db/scripts/apply-postgres-extras.sh "$CUSTOM_URL"    # explicit URL as first arg
```

The script is idempotent — it can be re-run safely after adding new `manual/*.sql` files or when a
table acquires an `updated_at` column after the trigger was last applied.

See `packages/db/docs/triggers-manifest.md` for the full reference of all triggers, functions,
materialized views, CHECK constraints, and functional indexes managed this way.

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
