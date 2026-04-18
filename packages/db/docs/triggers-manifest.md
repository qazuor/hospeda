# PostgreSQL Extras Manifest

This document is the single source of truth for all PostgreSQL features in the Hospeda database
that cannot be declared in Drizzle ORM schema files. It covers triggers, trigger functions,
materialized views, GIN indexes, functional unique indexes, and CHECK constraints that are applied
via manual SQL migrations.

For the architectural rationale see
[ADR-017](../../../docs/decisions/ADR-017-postgres-specific-features.md).

All manual migrations live under `packages/db/src/migrations/manual/` and are applied by a single
generic orchestrator. To apply (or re-apply) all of them on a fresh or schema-pushed database run:

```bash
pnpm db:apply-extras
```

This wrapper is also chained automatically into `db:fresh`, `db:fresh-dev`, and `db:reset` — so
most of the time you do not need to invoke it manually.

---

## File index

| # | File | Purpose |
|---|------|---------|
| 0001 | `0001_search_index_materialized_view.sql` | Create `search_index` MV (UNION of 4 entities) |
| 0002 | `0002_search_index_gin_index.sql` | GIN index `idx_search_index_tsv` |
| 0003 | `0003_search_index_entity_unique_index.sql` | UNIQUE index to enable `REFRESH CONCURRENTLY` |
| 0004 | `0004_refresh_search_index_function.sql` | `refresh_search_index()` function |
| 0005 | `0005_set_updated_at_trigger.sql` | Generic `set_updated_at` trigger on all tables with `updated_at` |
| 0006 | `0006_delete_entity_bookmarks_trigger.sql` | Cascade-delete user_bookmarks on 5 entity tables |
| 0007 | `0007_billing_addon_purchases_status_check.sql` | CHECK `status` IN list |
| 0008 | `0008_billing_addon_purchases_jsonb_checks.sql` | CHECK JSONB column types (array-or-null) |
| 0009 | `0009_notification_log_idempotency_index.sql` | UNIQUE partial index over JSONB-extracted key |
| 0010 | `0010_billing_subscription_events_event_type_check.sql` | CHECK `event_type` non-empty and ≤ 100 chars |

Files named `*_down.sql` (e.g. `0005_awesome_wild_child_down.sql`) are rollback scripts and are
skipped by the orchestrator. They are applied only through ad-hoc rollback procedures.

---

## 1. Triggers

### 1.1 `set_updated_at` — automatic `updated_at` timestamp

| Field | Value |
|-------|-------|
| **Function name** | `set_updated_at()` |
| **Trigger name pattern** | `trg_set_updated_at_<table>` |
| **Attached to** | All tables in `public` schema that have an `updated_at` column (dynamic, attached at migration time) |
| **Event** | `BEFORE UPDATE` |
| **Granularity** | `FOR EACH ROW` |
| **Purpose** | Sets `updated_at = NOW()` automatically on every UPDATE, so application code never has to pass a timestamp |
| **Migration file** | `manual/0005_set_updated_at_trigger.sql` |

**Notes:**

- The trigger is attached dynamically via a `DO $$` block that iterates
  `information_schema.columns` at migration execution time. Tables created after this migration is
  first applied will not receive the trigger unless `pnpm db:apply-extras` is re-run.
- The function silently ignores tables that somehow lack an `updated_at` column via an
  `EXCEPTION WHEN undefined_column` handler.

**Tables with this trigger (as of last migration run):**

All tables in `public` schema with an `updated_at` column — currently 43 tables including
`accommodations`, `destinations`, `events`, `posts`, `users`, and every other domain entity.

---

### 1.2 `delete_entity_bookmarks` — cascade bookmark deletion

| Field | Value |
|-------|-------|
| **Function name** | `delete_entity_bookmarks()` |
| **Trigger names** | `trg_delete_bookmarks_on_accommodations`, `trg_delete_bookmarks_on_destinations`, `trg_delete_bookmarks_on_events`, `trg_delete_bookmarks_on_users`, `trg_delete_bookmarks_on_posts` |
| **Attached to** | `accommodations`, `destinations`, `events`, `users`, `posts` |
| **Event** | `AFTER DELETE` |
| **Granularity** | `FOR EACH ROW` |
| **Purpose** | Deletes all rows from `user_bookmarks` where `entity_id = OLD.id` and `entity_type` matches the deleted entity. Keeps bookmarks consistent when a bookmarked entity is hard-deleted. |
| **Migration file** | `manual/0006_delete_entity_bookmarks_trigger.sql` |

**Notes:**

- Uses `TG_TABLE_NAME` to dispatch to the correct `entity_type` value (uppercase enum literals:
  `ACCOMMODATION`, `DESTINATION`, `EVENT`, `USER`, `POST`).
- The users table is named `users` (plural). Earlier history referenced a quoted `"user"` table;
  that was a reconstruction artifact and has been corrected.
- Triggers are dropped with `DROP TRIGGER IF EXISTS` and recreated so the correct function version
  is always attached on re-apply.

---

## 2. Materialized View: `search_index`

| Field | Value |
|-------|-------|
| **View name** | `search_index` |
| **Source tables** | `accommodations`, `destinations`, `events`, `posts` |
| **Columns** | `entity_type text`, `entity_id text`, `name text`, `description text`, `tsv tsvector` |
| **Filter** | `WHERE deleted_at IS NULL` on each source table |
| **tsvector language** | `spanish` |
| **Migration file** | `manual/0001_search_index_materialized_view.sql` |

### 2.1 GIN Index on `tsv`

| Field | Value |
|-------|-------|
| **Index name** | `idx_search_index_tsv` |
| **Index type** | GIN |
| **Column** | `tsv` |
| **Purpose** | Enables fast full-text search queries (`@@ to_tsquery(...)`) against the materialized view |
| **Migration file** | `manual/0002_search_index_gin_index.sql` |

### 2.2 UNIQUE Index on `(entity_type, entity_id)`

| Field | Value |
|-------|-------|
| **Index name** | `idx_search_index_entity_unique` |
| **Index type** | B-tree UNIQUE |
| **Columns** | `(entity_type, entity_id)` |
| **Purpose** | Required to allow `REFRESH MATERIALIZED VIEW CONCURRENTLY search_index`. Without this index, only the blocking `REFRESH MATERIALIZED VIEW` variant is usable. |
| **Migration file** | `manual/0003_search_index_entity_unique_index.sql` |

### 2.3 Refresh Function

| Field | Value |
|-------|-------|
| **Function name** | `refresh_search_index()` |
| **Returns** | `void` |
| **Implementation** | `REFRESH MATERIALIZED VIEW CONCURRENTLY search_index` |
| **Caller** | API cron job scheduler |
| **Migration file** | `manual/0004_refresh_search_index_function.sql` |

**Notes:**

- `REFRESH MATERIALIZED VIEW CONCURRENTLY` requires a unique index on the view; migration 0003
  provides it.
- The `pg_cron` schedule is intentionally omitted from the migration; the API's cron infrastructure
  handles scheduling instead.
- After a fresh `db:fresh-dev`, the view will be empty until the first refresh. Call
  `SELECT refresh_search_index();` manually after the initial apply if you need data immediately.

---

## 3. CHECK Constraints

These constraints enforce data integrity at the database level for columns whose values are also
validated at the application level by Zod schemas. Both layers must agree.

### 3.1 `billing_addon_purchases_status_check`

| Field | Value |
|-------|-------|
| **Constraint name** | `billing_addon_purchases_status_check` |
| **Table** | `billing_addon_purchases` |
| **Column** | `status` |
| **Definition** | `status IN ('active', 'expired', 'canceled', 'pending')` |
| **Migration file** | `manual/0007_billing_addon_purchases_status_check.sql` |

**Purpose:** Prevents invalid status values from being written by buggy code, direct SQL, or
scripts that bypass application-level Zod validation.

### 3.2 `chk_limit_adjustments_type`

| Field | Value |
|-------|-------|
| **Constraint name** | `chk_limit_adjustments_type` |
| **Table** | `billing_addon_purchases` |
| **Column** | `limit_adjustments` |
| **Definition** | `limit_adjustments IS NULL OR jsonb_typeof(limit_adjustments) = 'array'` |
| **Migration file** | `manual/0008_billing_addon_purchases_jsonb_checks.sql` |

**Purpose:** Guarantees `limit_adjustments` is always a JSON array (or NULL). Services that iterate
this column assume array semantics; a scalar or object would cause runtime failures.

### 3.3 `chk_entitlement_adjustments_type`

| Field | Value |
|-------|-------|
| **Constraint name** | `chk_entitlement_adjustments_type` |
| **Table** | `billing_addon_purchases` |
| **Column** | `entitlement_adjustments` |
| **Definition** | `entitlement_adjustments IS NULL OR jsonb_typeof(entitlement_adjustments) = 'array'` |
| **Migration file** | `manual/0008_billing_addon_purchases_jsonb_checks.sql` |

**Purpose:** Same guarantee as `chk_limit_adjustments_type`, applied to the entitlements column.

### 3.4 `billing_subscription_events_event_type_check`

| Field | Value |
|-------|-------|
| **Constraint name** | `billing_subscription_events_event_type_check` |
| **Table** | `billing_subscription_events` |
| **Column** | `event_type` |
| **Definition** | `event_type IS NULL OR (char_length(event_type) > 0 AND char_length(event_type) <= 100)` |
| **Migration file** | `manual/0010_billing_subscription_events_event_type_check.sql` |

**Purpose:** Rejects empty-string event types and enforces the `varchar(100)` limit defensively at
the DB level. Added in commit `1eb35632` (SPEC-064).

**Why these cannot be declared in Drizzle:** Drizzle's `.check()` builder does not support
expressions that call PostgreSQL functions such as `jsonb_typeof()` or `char_length()`. These
constraints must live in manual migrations. The Drizzle schema files contain JSDoc annotations on
each affected column pointing to the relevant migration file.

---

## 4. Functional / JSONB Indexes

### 4.1 `idx_notification_log_idempotency_key`

| Field | Value |
|-------|-------|
| **Index name** | `idx_notification_log_idempotency_key` |
| **Table** | `billing_notification_log` |
| **Definition** | `UNIQUE ((metadata->>'idempotencyKey')) WHERE metadata->>'idempotencyKey' IS NOT NULL` |
| **Purpose** | Enforces at-least-once notification delivery semantics by rejecting duplicate inserts sharing the same idempotency key when the key is present |
| **Migration file** | `manual/0009_notification_log_idempotency_index.sql` |

**Why this cannot be declared in Drizzle:** Unique partial indexes over JSONB-extracted expressions
(`metadata->>'key'`) are not expressible through Drizzle's index DSL.

---

## 5. Orchestrator: `apply-postgres-extras.sh`

The script `packages/db/scripts/apply-postgres-extras.sh` is a **generic orchestrator** that
iterates every `manual/*.sql` file in lexical order and applies it with
`psql --file --single-transaction`. It is invoked by the `pnpm db:apply-extras` wrapper, and
chained automatically into `db:fresh`, `db:fresh-dev`, and `db:reset`.

### Database URL resolution (precedence)

1. First CLI argument: `packages/db/scripts/apply-postgres-extras.sh "postgresql://..."`
2. Current shell `DATABASE_URL` or `HOSPEDA_DATABASE_URL`
3. `HOSPEDA_DATABASE_URL` extracted from `apps/api/.env.local`

### Idempotency

Every SQL file uses `IF NOT EXISTS`, `CREATE OR REPLACE`, and `DO $$` blocks with existence checks,
so the script is safe to run multiple times. Re-running after adding a new manual file only applies
that file's incremental changes.

### When to run manually

- Under normal workflow you should not need to — the wrapper is chained automatically.
- Re-run after adding a new `manual/*.sql` file.
- Re-run after creating a new table with an `updated_at` column (to attach the
  `set_updated_at` trigger to it).

---

## 6. Verification Queries

Run these after applying to confirm everything is in place:

```sql
-- Materialized view exists
SELECT relname FROM pg_class WHERE relkind = 'm' AND relname = 'search_index';

-- Search-index indexes
SELECT indexname FROM pg_indexes
WHERE tablename = 'search_index'
ORDER BY indexname;

-- Refresh function
SELECT proname FROM pg_proc WHERE proname = 'refresh_search_index';

-- set_updated_at triggers (one per table with updated_at)
SELECT COUNT(*) AS trg_set_updated_at_count
FROM pg_trigger
WHERE tgname LIKE 'trg_set_updated_at_%';

-- delete_entity_bookmarks triggers (should be 5)
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE 'trg_delete_bookmarks_%'
ORDER BY event_object_table;

-- CHECK constraints on billing_addon_purchases + billing_subscription_events
SELECT conname, conrelid::regclass
FROM pg_constraint
WHERE conname IN (
  'billing_addon_purchases_status_check',
  'chk_limit_adjustments_type',
  'chk_entitlement_adjustments_type',
  'billing_subscription_events_event_type_check'
);

-- Idempotency key index on notification log
SELECT indexname FROM pg_indexes
WHERE tablename = 'billing_notification_log'
  AND indexname = 'idx_notification_log_idempotency_key';
```
