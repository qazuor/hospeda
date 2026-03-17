# PostgreSQL Extras Manifest

This document is the single source of truth for all PostgreSQL features in the Hospeda database
that cannot be declared in Drizzle ORM schema files. It covers triggers, trigger functions,
materialized views, GIN indexes, and CHECK constraints that are applied via manual SQL migrations.

For the architectural rationale see
[ADR-017](../../docs/decisions/ADR-017-postgres-specific-features.md).

To apply all of these features on a fresh or schema-pushed database run:

```bash
packages/db/scripts/apply-postgres-extras.sh
```

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
| **Migration file** | `packages/db/src/migrations/manual/0019_add_generic_updated_at_trigger.sql` |

**Notes:**

- The trigger is attached dynamically via a `DO $$` block that iterates
  `information_schema.columns` at migration execution time. Tables created after this migration
  is first applied will not receive the trigger unless the script is re-run.
- The function silently ignores tables that somehow lack an `updated_at` column via an
  `EXCEPTION WHEN undefined_column` handler.

**Tables with this trigger (as of last migration run):**

accommodations, destinations, events, posts, users, and any other table in `public` schema that
defines an `updated_at` column at the time the migration is applied.

---

### 1.2 `delete_entity_bookmarks` — cascade bookmark deletion

| Field | Value |
|-------|-------|
| **Function name** | `delete_entity_bookmarks()` |
| **Trigger names** | `trg_delete_bookmarks_on_accommodations`, `trg_delete_bookmarks_on_destinations`, `trg_delete_bookmarks_on_events`, `trg_delete_bookmarks_on_user`, `trg_delete_bookmarks_on_posts` |
| **Attached to** | `accommodations`, `destinations`, `events`, `"user"`, `posts` |
| **Event** | `AFTER DELETE` |
| **Granularity** | `FOR EACH ROW` |
| **Purpose** | Deletes all rows from `user_bookmarks` where `entity_id = OLD.id` and `entity_type` matches the deleted entity. Keeps bookmarks consistent when a bookmarked entity is hard-deleted. |
| **Migration file** | `packages/db/src/migrations/manual/0020_add_delete_entity_bookmarks_trigger.sql` |

**Notes:**

- Uses `TG_TABLE_NAME` to dispatch to the correct `entity_type` value (uppercase enum literals:
  `ACCOMMODATION`, `DESTINATION`, `EVENT`, `USER`, `POST`).
- Migration 0020 replaces an earlier version that used lowercase enum literals. Triggers are
  dropped with `DROP TRIGGER IF EXISTS` and recreated to ensure the correct function version is
  attached.
- The `"user"` table name is quoted because `user` is a reserved word in PostgreSQL.

---

## 2. Materialized View: `search_index`

| Field | Value |
|-------|-------|
| **View name** | `search_index` |
| **Source tables** | `accommodations`, `destinations`, `events`, `posts` |
| **Columns** | `entity_type text`, `entity_id text`, `name text`, `description text`, `tsv tsvector` |
| **Filter** | `WHERE deleted_at IS NULL` on each source table |
| **tsvector language** | `spanish` |
| **Migration file** | `packages/db/src/migrations/manual/0016_create_search_index.sql` |

### 2.1 GIN Index on `tsv`

| Field | Value |
|-------|-------|
| **Index name** | `idx_search_index_tsv` |
| **Index type** | GIN |
| **Column** | `tsv` |
| **Purpose** | Enables fast full-text search queries (`@@ to_tsquery(...)`) against the materialized view |
| **Migration file** | `packages/db/src/migrations/manual/0017_create_search_index_gin.sql` |

### 2.2 Refresh Function

| Field | Value |
|-------|-------|
| **Function name** | `refresh_search_index()` |
| **Returns** | `void` |
| **Implementation** | `REFRESH MATERIALIZED VIEW CONCURRENTLY search_index` |
| **Caller** | API cron job scheduler (nightly) |
| **Migration file** | `packages/db/src/migrations/manual/0018_refresh_search_index_function.sql` |

**Notes:**

- `REFRESH MATERIALIZED VIEW CONCURRENTLY` requires a unique index on the view. The GIN index on
  `tsv` alone is not sufficient for `CONCURRENTLY` — a `UNIQUE` index on `(entity_type, entity_id)`
  may be needed if concurrent refresh is used in production.
- The `pg_cron` schedule is commented out in the migration file. Scheduling is handled by the API's
  cron job infrastructure instead.
- After a `drizzle-kit push` or `pnpm db:fresh-dev`, the view will be empty until the first
  refresh. Call `SELECT refresh_search_index();` manually after the initial apply if you need data
  immediately.

---

## 3. CHECK Constraints on `billing_addon_purchases`

These constraints enforce data integrity at the database level for columns whose values are
validated at the application level by Zod schemas. Both layers must agree.

### 3.1 `billing_addon_purchases_status_check`

| Field | Value |
|-------|-------|
| **Constraint name** | `billing_addon_purchases_status_check` |
| **Table** | `billing_addon_purchases` |
| **Column** | `status` |
| **Constraint definition** | `status IN ('active', 'expired', 'canceled', 'pending')` |
| **Migration file** | `packages/db/src/migrations/0025_addon_purchases_status_check.sql` |

**Purpose:** Prevents invalid status values from being written by buggy code, direct SQL, or
scripts that bypass application-level Zod validation.

### 3.2 `chk_limit_adjustments_type`

| Field | Value |
|-------|-------|
| **Constraint name** | `chk_limit_adjustments_type` |
| **Table** | `billing_addon_purchases` |
| **Column** | `limit_adjustments` |
| **Constraint definition** | `limit_adjustments IS NULL OR jsonb_typeof(limit_adjustments) = 'array'` |
| **Migration file** | `packages/db/src/migrations/0026_addon_purchases_jsonb_check.sql` |

**Purpose:** Guarantees `limit_adjustments` is always a JSON array (or NULL). Services that
iterate this column assume array semantics; a scalar or object would cause runtime failures.

### 3.3 `chk_entitlement_adjustments_type`

| Field | Value |
|-------|-------|
| **Constraint name** | `chk_entitlement_adjustments_type` |
| **Table** | `billing_addon_purchases` |
| **Column** | `entitlement_adjustments` |
| **Constraint definition** | `entitlement_adjustments IS NULL OR jsonb_typeof(entitlement_adjustments) = 'array'` |
| **Migration file** | `packages/db/src/migrations/0026_addon_purchases_jsonb_check.sql` |

**Purpose:** Same guarantee as `chk_limit_adjustments_type`, applied to the entitlements column.

**Why these cannot be declared in Drizzle:** Drizzle's `.check()` builder does not support
expressions that call PostgreSQL functions such as `jsonb_typeof()`. These constraints must live
in manual migrations. The Drizzle schema file (`billing_addon_purchase.dbschema.ts`) contains
JSDoc annotations on each affected column pointing to the relevant migration number.

---

## 4. Applying Everything: `apply-postgres-extras.sh`

The script `packages/db/scripts/apply-postgres-extras.sh` applies all items in this manifest in
dependency order:

1. Materialized view creation (0016)
2. GIN index (0017)
3. Refresh function (0018)
4. `set_updated_at` trigger (0019)
5. `delete_entity_bookmarks` trigger (0020)
6. `status` CHECK constraint (0025)
7. JSONB CHECK constraints (0026)

All steps use `IF NOT EXISTS` or `CREATE OR REPLACE` so the script is **idempotent** and safe to
run on an already-configured database.

### When to run

- After `pnpm db:fresh-dev` (schema push without migrations)
- After `pnpm db:fresh` (reset + migrate + seed) — the Drizzle migrations handle 0025 and 0026
  but the manual migrations in `manual/` are NOT applied by `drizzle-kit migrate`
- After any `drizzle-kit push` in a development environment
- As a one-time step when provisioning a new environment

---

## 5. Verification Queries

Run these after applying to confirm everything is in place:

```sql
-- Materialized view
SELECT COUNT(*) FROM search_index;

-- GIN index
SELECT indexname FROM pg_indexes
WHERE tablename = 'search_index' AND indexname = 'idx_search_index_tsv';

-- Refresh function
SELECT proname FROM pg_proc WHERE proname = 'refresh_search_index';

-- set_updated_at triggers (should appear for every table with updated_at)
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE 'trg_set_updated_at_%'
ORDER BY event_object_table;

-- delete_entity_bookmarks triggers
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE 'trg_delete_bookmarks_%'
ORDER BY event_object_table;

-- CHECK constraints
SELECT conname, conrelid::regclass
FROM pg_constraint
WHERE contype = 'c'
  AND conrelid = 'billing_addon_purchases'::regclass;
```
