# SPEC-078-GAPS Phase 1B — Migration Audit

> Generated: 2026-04-18
> Sub-step of task T-004 (read-only audit before writing migrations)

## Summary

- Total SQL objects audited: 10
- Objects currently live only in `apply-postgres-extras.sh` (inline SQL, not a separate file): 5
  - `set_updated_at()` function (step 4, inline SQL in script)
  - `set_updated_at` trigger DO block (step 4, inline SQL in script)
  - `billing_addon_purchases_status_check` CHECK (step 6, inline SQL in script)
  - `chk_limit_adjustments_type` CHECK (step 7, inline SQL in script)
  - `chk_entitlement_adjustments_type` CHECK (step 7, inline SQL in script)
- Objects that reference external files (file path exists in script but the file is absent from repo): 5
  - `manual/0016_create_search_index.sql`
  - `manual/0017_create_search_index_gin.sql`
  - `manual/0018_refresh_search_index_function.sql`
  - `manual/0019_add_generic_updated_at_trigger.sql`
  - `manual/0020_add_delete_entity_bookmarks_trigger.sql`
- Objects in existing committed migration files (.sql present in repo): 0 that are non-Drizzle
  (0025 and 0026 referenced in triggers-manifest.md were deleted in commit f9e0d338 and never recreated)
- New object not yet anywhere (GAP-078-187): 1
  - `UNIQUE INDEX search_index_entity_key (entity_type, entity_id)` on `search_index`
- Orphan journal entries: 1 (`0002_kind_wolfpack`) — status: SQL file EXISTS, not an orphan

### Key finding

The `manual/` directory exists but is **empty**. All five manual migration files were deleted in
commit `f9e0d338` ("chore(db): remove all migration files for fresh schema-push workflow",
2026-03-17). Their SQL content is recoverable verbatim from `git show f9e0d338~1:...`.

The `apply-postgres-extras.sh` script references those files via `run_file()` calls. Running it on
a fresh clone currently **fails with `ERROR: Migration file not found`** for all five `run_file`
steps. The inline `run_sql()` steps (set_updated_at, CHECK constraints) would still run because
they embed SQL directly.

The `0026` migration file (JSONB CHECKs) was also deleted in `f9e0d338` and was never recovered.
Its SQL is embedded inline in `apply-postgres-extras.sh` steps 7 and 9.

---

## Object Map

### 1. `search_index` Materialized View

- **Current location**: referenced by `apply-postgres-extras.sh` line 108 via `run_file()`, but
  the file `packages/db/src/migrations/manual/0016_create_search_index.sql` **does not exist** in
  the working tree. SQL is recoverable from git commit `f9e0d338~1`.
- **Target migration**: `packages/db/src/migrations/manual/0016_create_search_index.sql`
- **Depends on**: `accommodations` (columns: `id`, `name`, `description`, `deleted_at`),
  `destinations` (columns: `id`, `name`, `summary`, `deleted_at`),
  `events` (columns: `id`, `name`, `summary`, `deleted_at`),
  `posts` (columns: `id`, `title`, `summary`, `deleted_at`)
- **SQL prototype** (verbatim from `git show f9e0d338~1:packages/db/src/migrations/manual/0016_create_search_index.sql`):

```sql
-- migrations/triggers/20250513_create_search_index.sql

-- 1. vista materializada con union de todas las entidades
CREATE MATERIALIZED VIEW IF NOT EXISTS search_index AS
SELECT
  'ACCOMMODATION'::text AS entity_type,
  id::text       AS entity_id,
  name,
  description,
  to_tsvector('spanish', coalesce(name, '') || ' ' || coalesce(description, '')) AS tsv
FROM accommodations
WHERE deleted_at IS NULL

UNION ALL

SELECT
  'DESTINATION'::text AS entity_type,
  id::text       AS entity_id,
  name,
  summary        AS description,
  to_tsvector('spanish', coalesce(name, '') || ' ' || coalesce(summary, '')) AS tsv
FROM destinations
WHERE deleted_at IS NULL

UNION ALL

SELECT
  'EVENT'::text AS entity_type,
  id::text      AS entity_id,
  name,
  summary       AS description,
  to_tsvector('spanish', coalesce(name, '') || ' ' || coalesce(summary, '')) AS tsv
FROM events
WHERE deleted_at IS NULL

UNION ALL

SELECT
  'POST'::text AS entity_type,
  id::text     AS entity_id,
  title        AS name,
  summary      AS description,
  to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(summary, '')) AS tsv
FROM posts
WHERE deleted_at IS NULL
;
```

- **Notes**:
  - Uses `IF NOT EXISTS` — idempotent.
  - `destinations` and `events` use `summary` mapped to the `description` output column (not a
    column named `description`). The `posts` table uses `title` as `name`. These must match the
    actual column names in the current schema.
  - `to_tsvector('spanish', ...)` is the language configuration. Matches the manifest.
  - The materialized view must exist before the GIN index (0017) or the UNIQUE index (new 0021)
    can be created.

---

### 2. GIN Index `idx_search_index_tsv`

- **Current location**: referenced by `apply-postgres-extras.sh` line 118 via `run_file()`, but
  the file `packages/db/src/migrations/manual/0017_create_search_index_gin.sql` **does not exist**
  in the working tree. SQL recoverable from `git show f9e0d338~1:...`.
- **Target migration**: `packages/db/src/migrations/manual/0017_create_search_index_gin.sql`
- **Depends on**: `search_index` materialized view (0016 must run first)
- **SQL prototype** (verbatim from `git show f9e0d338~1:packages/db/src/migrations/manual/0017_create_search_index_gin.sql`):

```sql
-- migrations/triggers/20250513_create_search_index_gin.sql

CREATE INDEX IF NOT EXISTS idx_search_index_tsv
  ON search_index
  USING GIN(tsv);
```

- **Notes**:
  - Uses `IF NOT EXISTS` — idempotent.
  - GIN index alone does **not** satisfy the uniqueness requirement for
    `REFRESH MATERIALIZED VIEW CONCURRENTLY`. A separate UNIQUE index on `(entity_type, entity_id)`
    is required (see object 3 below, GAP-078-187).

---

### 3. UNIQUE INDEX `search_index_entity_key` — GAP-078-187

- **Current location**: **Does not exist anywhere** — not in any SQL file, not in
  `apply-postgres-extras.sh`, not in git history. This is a net-new object identified in
  GAP-078-187.
- **Target migration**: `packages/db/src/migrations/manual/0021_search_index_unique.sql`
  (new file, no historical prototype)
- **Depends on**: `search_index` materialized view (0016 must run first)
- **SQL prototype** (derived from GAP-078-187 decision in `specs-gaps-078-decisions.md`):

```sql
-- manual/0021_search_index_unique.sql
-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY to work.
-- Without this unique index, concurrent refresh raises:
--   ERROR: cannot refresh materialized view "search_index" concurrently
-- See: packages/db/docs/triggers-manifest.md section 2.2 Notes

CREATE UNIQUE INDEX IF NOT EXISTS idx_search_index_entity_unique
  ON search_index (entity_type, entity_id);
```

- **Notes**:
  - The spec (GAP-078-187) proposes index name `search_index_entity_key`. The triggers-manifest
    and specs-gaps-078.md use `idx_search_index_entity_unique`. **The implementation agent must
    choose one canonical name and use it consistently** across this file and
    `apply-postgres-extras.sh`.
  - `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS` would be safer in production but cannot run
    inside a transaction block. Since the script uses `--single-transaction` per `psql` invocation,
    the `run_sql` helper would need to invoke this step without `--single-transaction`. Flag for
    implementation agent.
  - The `CONCURRENTLY` qualifier is only relevant when creating the index on a live, populated MV.
    On a fresh clone the MV is empty so `CONCURRENTLY` is optional but harmless to omit.
  - This index must be created **after** 0016 (MV) and **before** 0018 (refresh function is called,
    because calling `refresh_search_index()` would fail without it).

---

### 4. `refresh_search_index()` Function

- **Current location**: referenced by `apply-postgres-extras.sh` line 129 via `run_file()`, but
  the file `packages/db/src/migrations/manual/0018_refresh_search_index_function.sql` **does not
  exist** in the working tree. SQL recoverable from `git show f9e0d338~1:...`.
- **Target migration**: `packages/db/src/migrations/manual/0018_refresh_search_index_function.sql`
- **Depends on**: `search_index` materialized view (0016); the UNIQUE index (0021) must exist
  before this function is first invoked (not strictly a creation dependency, but a runtime
  dependency for `CONCURRENTLY`).
- **SQL prototype** (verbatim from `git show f9e0d338~1:packages/db/src/migrations/manual/0018_refresh_search_index_function.sql`):

```sql
-- migrations/triggers/20250513_refresh_search_index_function.sql

-- 1) Función para refrescar la vista
CREATE OR REPLACE FUNCTION refresh_search_index()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY search_index;
END;
$$;

-- 2) (Opcional) Programar con pg_cron para que corra cada noche a las 2AM
-- Requires the pg_cron extension
-- SELECT cron.schedule('refresh_search_index', '0 2 * * *', 'SELECT refresh_search_index();');
```

- **Notes**:
  - Uses `CREATE OR REPLACE FUNCTION` — idempotent.
  - The `pg_cron` schedule line is commented out. Scheduling is handled by the API cron
    infrastructure. Do not uncomment.
  - `REFRESH MATERIALIZED VIEW CONCURRENTLY` will fail at runtime (not at function creation time)
    if the UNIQUE index is absent.

---

### 5. `set_updated_at` Trigger Function + Dynamic Trigger Attachment

- **Current location**: `apply-postgres-extras.sh` lines 150–191, **inline SQL** passed to two
  `run_sql()` calls (step 4 of the script). The file
  `packages/db/src/migrations/manual/0019_add_generic_updated_at_trigger.sql` **does not exist** in
  the working tree. The historical SQL content (from `git show f9e0d338~1:...`) differs slightly
  from the current inline version in the script.
- **Target migration**: `packages/db/src/migrations/manual/0019_add_generic_updated_at_trigger.sql`
- **Depends on**: all public tables with `updated_at` column must exist (i.e., run after all
  Drizzle-managed migrations)
- **SQL prototype — CURRENT version** (verbatim from `apply-postgres-extras.sh` lines 150–191,
  which is the authoritative current form since the script is live code):

```sql
-- Part A: trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
   RETURNS TRIGGER AS $$
 BEGIN
   IF TG_OP = 'UPDATE' THEN
     BEGIN
       NEW.updated_at := NOW();
     EXCEPTION WHEN undefined_column THEN
       NULL;
     END;
   END IF;
   RETURN NEW;
 END;
 $$ LANGUAGE plpgsql;

-- Part B: dynamic trigger attachment (idempotent via IF NOT EXISTS check)
DO $$
 DECLARE
   tbl RECORD;
 BEGIN
   FOR tbl IN
     SELECT table_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND column_name = 'updated_at'
   LOOP
     IF NOT EXISTS (
       SELECT 1 FROM information_schema.triggers
       WHERE trigger_schema = 'public'
         AND event_object_table = tbl.table_name
         AND trigger_name = 'trg_set_updated_at_' || tbl.table_name
     ) THEN
       EXECUTE format($fmt$
         CREATE TRIGGER trg_set_updated_at_%1$I
           BEFORE UPDATE ON public.%1$I
           FOR EACH ROW
           EXECUTE FUNCTION set_updated_at();
       $fmt$, tbl.table_name);
     END IF;
   END LOOP;
 END;
 $$;
```

- **Notes**:
  - The historical file (pre-`f9e0d338`) used a raw `EXECUTE format(...)` without the
    `IF NOT EXISTS` guard in the DO block. The current inline version in the script adds the guard.
    The migration file should use the **current, more idempotent version**.
  - The script currently passes these two SQL strings via separate `run_sql()` calls, each with
    `--single-transaction`. The SQL file should contain both statements separated so that a runner
    can execute the full file in a single `psql --file` invocation.
  - The trigger is attached dynamically at runtime to all tables that exist at that moment. Tables
    added after this migration runs will not receive the trigger until the script is re-run. This is
    a known limitation documented in ADR-017.

---

### 6. `delete_entity_bookmarks` Trigger Function + Per-Table Triggers

- **Current location**: referenced by `apply-postgres-extras.sh` line 205 via `run_file()`, but
  the file `packages/db/src/migrations/manual/0020_add_delete_entity_bookmarks_trigger.sql` **does
  not exist** in the working tree. SQL recoverable from `git show f9e0d338~1:...`.
- **Target migration**: `packages/db/src/migrations/manual/0020_add_delete_entity_bookmarks_trigger.sql`
- **Depends on**: `user_bookmarks` table must exist; `accommodations`, `destinations`, `events`,
  `"user"`, `posts` tables must exist.
- **SQL prototype** (verbatim from `git show f9e0d338~1:packages/db/src/migrations/manual/0020_add_delete_entity_bookmarks_trigger.sql`):

```sql
-- ================================================================
-- Migration: 20250513_update_delete_entity_bookmarks_trigger.sql
-- Purpose: Update delete_entity_bookmarks() to match uppercase
--          EntityTypeEnum values and reattach triggers.
-- ================================================================

-- 1) Replace the trigger function with uppercase enum literals
CREATE OR REPLACE FUNCTION delete_entity_bookmarks()
  RETURNS TRIGGER AS $$
BEGIN
  -- Determine which entity type fired this trigger based on table name
  IF TG_TABLE_NAME = 'accommodations' THEN
    -- Accommodation was deleted
    DELETE FROM user_bookmarks
      WHERE entity_type = 'ACCOMMODATION'
        AND entity_id = OLD.id;

  ELSIF TG_TABLE_NAME = 'destinations' THEN
    -- Destination was deleted
    DELETE FROM user_bookmarks
      WHERE entity_type = 'DESTINATION'
        AND entity_id = OLD.id;

  ELSIF TG_TABLE_NAME = 'events' THEN
    -- Event was deleted
    DELETE FROM user_bookmarks
      WHERE entity_type = 'EVENT'
        AND entity_id = OLD.id;

  ELSIF TG_TABLE_NAME = 'user' THEN
    -- User was deleted
    DELETE FROM user_bookmarks
      WHERE entity_type = 'USER'
        AND entity_id = OLD.id;

  ELSIF TG_TABLE_NAME = 'posts' THEN
    -- Post was deleted
    DELETE FROM user_bookmarks
      WHERE entity_type = 'POST'
        AND entity_id = OLD.id;

  ELSE
    -- Other tables: do nothing
    RETURN OLD;
  END IF;

  -- Return OLD to allow the deletion to proceed
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;


-- 2) Drop existing triggers (if they exist) and reattach them

-- For accommodations
DROP TRIGGER IF EXISTS trg_delete_bookmarks_on_accommodations ON accommodations;
CREATE TRIGGER trg_delete_bookmarks_on_accommodations
  AFTER DELETE ON accommodations
  FOR EACH ROW
  EXECUTE FUNCTION delete_entity_bookmarks();

-- For destinations
DROP TRIGGER IF EXISTS trg_delete_bookmarks_on_destinations ON destinations;
CREATE TRIGGER trg_delete_bookmarks_on_destinations
  AFTER DELETE ON destinations
  FOR EACH ROW
  EXECUTE FUNCTION delete_entity_bookmarks();

-- For events
DROP TRIGGER IF EXISTS trg_delete_bookmarks_on_events ON events;
CREATE TRIGGER trg_delete_bookmarks_on_events
  AFTER DELETE ON events
  FOR EACH ROW
  EXECUTE FUNCTION delete_entity_bookmarks();

-- For users
DROP TRIGGER IF EXISTS trg_delete_bookmarks_on_user ON "user";
CREATE TRIGGER trg_delete_bookmarks_on_user
  AFTER DELETE ON "user"
  FOR EACH ROW
  EXECUTE FUNCTION delete_entity_bookmarks();

-- For posts
DROP TRIGGER IF EXISTS trg_delete_bookmarks_on_posts ON posts;
CREATE TRIGGER trg_delete_bookmarks_on_posts
  AFTER DELETE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION delete_entity_bookmarks();
```

- **Notes**:
  - Uses `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` — idempotent.
  - Uses `CREATE OR REPLACE FUNCTION` — idempotent.
  - The `"user"` table must be quoted (reserved word). The historical file uses `ON "user"`.
  - Triggers-manifest notes this is an "updated" version that replaced lowercase enum literals
    with uppercase. The historical file already uses uppercase. No further change needed.

---

### 7. `billing_addon_purchases_status_check` CHECK Constraint

- **Current location**: `apply-postgres-extras.sh` lines 218–230, **inline SQL** in a `run_sql()`
  call (step 6). The file `packages/db/src/migrations/0025_addon_purchases_status_check.sql` was
  deleted in commit `f9e0d338`. A non-idempotent version is recoverable from
  `git show f9e0d338~1:packages/db/src/migrations/0025_addon_purchases_status_check.sql`.
- **Target migration**: `packages/db/src/migrations/0025_addon_purchases_status_check.sql`
  (numbered in the Drizzle sequence, per triggers-manifest and ADR-017)
- **Depends on**: `billing_addon_purchases` table must exist.
- **SQL prototype — CURRENT version** (verbatim from `apply-postgres-extras.sh` lines 218–230,
  which is the idempotent form; the historical file lacked the DO block):

```sql
DO $$
 BEGIN
   IF NOT EXISTS (
     SELECT 1 FROM pg_constraint
     WHERE conname = 'billing_addon_purchases_status_check'
       AND conrelid = 'billing_addon_purchases'::regclass
   ) THEN
     ALTER TABLE billing_addon_purchases
       ADD CONSTRAINT billing_addon_purchases_status_check
       CHECK (status IN ('active', 'expired', 'canceled', 'pending'));
   END IF;
 END;
 $$;
```

- **Notes**:
  - The historical `.sql` file was a bare `ALTER TABLE ... ADD CONSTRAINT` without the `DO $$`
    idempotency guard. The migration file should use the **current, wrapped version** from the
    script.
  - This constraint is applied via `apply-postgres-extras.sh` (step 6) and also was previously
    meant to be a numbered Drizzle migration (`0025`). Both ADR-017 and triggers-manifest list it
    as migration `0025_addon_purchases_status_check.sql`. Recreating the file at that path is
    consistent with the documented intent.

---

### 8. `chk_limit_adjustments_type` CHECK Constraint

- **Current location**: `apply-postgres-extras.sh` lines 240–252, **inline SQL** in a `run_sql()`
  call (step 7). No dedicated `.sql` file exists. Triggers-manifest and ADR-017 reference
  `0026_addon_purchases_jsonb_check.sql` (which was deleted in `f9e0d338` and never recovered;
  git history shows it was never created separately — it does not appear in any `--diff-filter=A`
  query).
- **Target migration**: `packages/db/src/migrations/0026_addon_purchases_jsonb_check.sql`
- **Depends on**: `billing_addon_purchases` table must exist.
- **SQL prototype** (verbatim from `apply-postgres-extras.sh` lines 240–252):

```sql
DO $$
 BEGIN
   IF NOT EXISTS (
     SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_limit_adjustments_type'
       AND conrelid = 'billing_addon_purchases'::regclass
   ) THEN
     ALTER TABLE billing_addon_purchases
       ADD CONSTRAINT chk_limit_adjustments_type
       CHECK (limit_adjustments IS NULL OR jsonb_typeof(limit_adjustments) = 'array');
   END IF;
 END;
 $$;
```

- **Notes**:
  - Must be combined with the `chk_entitlement_adjustments_type` constraint in the same file
    (`0026`) since both are documented as belonging to the same migration in ADR-017 and the
    triggers-manifest.

---

### 9. `chk_entitlement_adjustments_type` CHECK Constraint

- **Current location**: `apply-postgres-extras.sh` lines 254–266, **inline SQL** in a second
  `run_sql()` call within step 7. Same migration file as object 8.
- **Target migration**: `packages/db/src/migrations/0026_addon_purchases_jsonb_check.sql`
  (same file as `chk_limit_adjustments_type`)
- **Depends on**: `billing_addon_purchases` table must exist.
- **SQL prototype** (verbatim from `apply-postgres-extras.sh` lines 254–266):

```sql
DO $$
 BEGIN
   IF NOT EXISTS (
     SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_entitlement_adjustments_type'
       AND conrelid = 'billing_addon_purchases'::regclass
   ) THEN
     ALTER TABLE billing_addon_purchases
       ADD CONSTRAINT chk_entitlement_adjustments_type
       CHECK (entitlement_adjustments IS NULL OR jsonb_typeof(entitlement_adjustments) = 'array');
   END IF;
 END;
 $$;
```

---

### 10. Idempotency Key Unique Index on `billing_notification_log`

- **Current location**: `apply-postgres-extras.sh` lines 279–282, **inline SQL** in a `run_sql()`
  call (step 8 in the current script). This was added in the most recent modification commit
  `1eb35632`. No dedicated manual migration file is referenced for this object.
- **Target migration**: `packages/db/src/migrations/manual/0022_notification_log_idempotency_idx.sql`
  (new file — not referenced in ADR-017 or triggers-manifest, but the script applies it)
- **Depends on**: `billing_notification_log` table with a `metadata` JSONB column must exist.
- **SQL prototype** (verbatim from `apply-postgres-extras.sh` lines 279–282):

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_log_idempotency_key
ON billing_notification_log ((metadata->>'idempotencyKey'))
WHERE metadata->>'idempotencyKey' IS NOT NULL;
```

- **Notes**:
  - Uses `IF NOT EXISTS` — idempotent.
  - This is a JSONB functional expression index, which Drizzle cannot declare natively (same
    category as the `jsonb_typeof()` CHECKs).
  - Not documented in ADR-017 or triggers-manifest (they predate the `1eb35632` commit).
    Both docs should be updated to reflect this object.
  - The script header comment still lists "migrations 0016-0020, 0025-0026" but silently applies
    this ninth object. This inconsistency should be fixed in the script header.

---

### 11. `billing_subscription_events_event_type_check` CHECK Constraint

- **Current location**: `apply-postgres-extras.sh` lines 292–306, **inline SQL** in a `run_sql()`
  call (step 9 in the current script — the header incorrectly labels it "[9/9]" while step 8 was
  "[8/8]", a copy-paste issue). Added in the most recent modification commit `1eb35632`.
- **Target migration**: No dedicated file exists or is referenced. Not in ADR-017 or
  triggers-manifest.
- **Depends on**: `billing_subscription_events` table with `event_type varchar(100)` column.
- **SQL prototype** (verbatim from `apply-postgres-extras.sh` lines 292–306):

```sql
DO $$
 BEGIN
   IF NOT EXISTS (
     SELECT 1 FROM pg_constraint
     WHERE conname = 'billing_subscription_events_event_type_check'
       AND conrelid = 'billing_subscription_events'::regclass
   ) THEN
     ALTER TABLE billing_subscription_events
       ADD CONSTRAINT billing_subscription_events_event_type_check
       CHECK (event_type IS NULL OR (char_length(event_type) > 0 AND char_length(event_type) <= 100));
   END IF;
 END;
 $$;
```

- **Notes**:
  - Added in commit `1eb35632` (2026-04-18, same session). Not in ADR-017 or triggers-manifest.
    This is a **newly discovered object** beyond the original SPEC-078-GAPS audit scope.
  - Should get a dedicated migration file. Suggested:
    `packages/db/src/migrations/0027_subscription_events_event_type_check.sql`.
  - ADR-017 and triggers-manifest should be updated to cover this.

---

## Orphan Entry: `0002_kind_wolfpack`

- Journal entry exists at `_journal.json` idx=2, when=1775101701553.
- Matching SQL file: `packages/db/src/migrations/0002_kind_wolfpack.sql` — **EXISTS**.
- Content summary: adds `event_type varchar(100)` column to `billing_subscription_events`, drops
  NOT NULL from `previous_status` and `new_status`, creates composite index
  `idx_subscription_events_event_type`. Also migrates `owner_promotions` from `is_active boolean`
  to `lifecycle_state lifecycle_status_enum DEFAULT 'ACTIVE' NOT NULL` with new indexes.
- **Recommendation**: Keep as-is. The journal entry has a matching SQL file with valid content. It
  was manually generated (the header says "Generated manually from schema diff") and committed in
  `189f57a3`. Not an orphan; the GAP-078-189 concern was based on the file being absent in an
  earlier state, before that commit.

---

## Recommended Migration Order

When the implementation agent creates the files, `apply-postgres-extras.sh` must call them in
this order:

1. `manual/0016_create_search_index.sql` — create the materialized view (no dependencies on
   non-Drizzle objects; source tables must exist via Drizzle migrations first)
2. `manual/0017_create_search_index_gin.sql` — GIN index (depends on MV existing)
3. `manual/0021_search_index_unique.sql` — UNIQUE index on `(entity_type, entity_id)` (depends on
   MV existing; must be created before `refresh_search_index()` is ever called with CONCURRENTLY)
4. `manual/0018_refresh_search_index_function.sql` — refresh function (depends on MV existing;
   CONCURRENTLY works only after the UNIQUE index from step 3 exists)
5. `manual/0019_add_generic_updated_at_trigger.sql` — set_updated_at (depends on all tables with
   `updated_at` existing, i.e., after all Drizzle migrations)
6. `manual/0020_add_delete_entity_bookmarks_trigger.sql` — delete_entity_bookmarks (depends on
   `user_bookmarks`, `accommodations`, `destinations`, `events`, `"user"`, `posts` tables)
7. `0025_addon_purchases_status_check.sql` — status CHECK (depends on `billing_addon_purchases`)
8. `0026_addon_purchases_jsonb_check.sql` — JSONB CHECKs (depends on `billing_addon_purchases`)
9. `manual/0022_notification_log_idempotency_idx.sql` — idempotency index (depends on
   `billing_notification_log` with `metadata` JSONB column)
10. `0027_subscription_events_event_type_check.sql` — event_type CHECK (depends on
    `billing_subscription_events`)

**Justification**: MV must precede all indexes on it. UNIQUE index (step 3) must precede the
refresh function file so that the function body can safely call `CONCURRENTLY` on first use.
Trigger migrations depend on all base tables existing. CHECK constraints and functional indexes are
independent of each other but depend on their respective tables.

---

## Open Questions / Ambiguities

1. **Index name: `search_index_entity_key` vs `idx_search_index_entity_unique`**. The spec
   (GAP-078-187, `specs-gaps-078.md`) proposes `idx_search_index_entity_unique`; the T-004 task
   description says `search_index_entity_key`. These are different names for the same index. The
   implementation agent must pick one and use it consistently in both the SQL file and
   `apply-postgres-extras.sh`. Recommend `idx_search_index_entity_unique` (matches the
   conventional `idx_<table>_<purpose>` naming pattern used elsewhere in this project).

2. **`CREATE UNIQUE INDEX CONCURRENTLY` inside a transaction**. The `apply-postgres-extras.sh`
   helper `run_sql()` passes `--single-transaction` to `psql`. `CREATE INDEX CONCURRENTLY` cannot
   run inside a transaction block. The implementation agent must either: (a) use a non-CONCURRENTLY
   form (safe on a fresh/empty MV), or (b) issue the index creation via a separate `psql` call
   without `--single-transaction`. On a fresh clone the MV is empty so `CONCURRENTLY` is
   unnecessary. Recommend option (a): use `CREATE UNIQUE INDEX IF NOT EXISTS` without
   `CONCURRENTLY` for the migration file, and note in a comment that on a live populated MV with
   heavy read traffic, a DBA should create it manually with `CONCURRENTLY`.

3. **Objects 10 and 11 are absent from ADR-017 and triggers-manifest**. They were added in commit
   `1eb35632` after those docs were last updated. The implementation agent should update
   `docs/decisions/ADR-017-postgres-specific-features.md` and
   `packages/db/docs/triggers-manifest.md` to include them, or flag for user decision.

4. **`apply-postgres-extras.sh` header comment mismatch**. The script header lists 8 steps and
   maps to migrations `0016-0020, 0025-0026` but the actual script now runs 9 steps (including the
   new idempotency key index and event_type CHECK). The header should be updated in the same PR
   that creates the migration files.

5. **`posts` column name for `summary`**. The MV prototype uses `summary` for the posts source
   table. The implementation agent should verify that the `posts` table schema has a `summary`
   column (not, e.g., `excerpt` or `body`). If the column name differs, the MV prototype must be
   corrected before writing the file.

6. **`0025` and `0026` as numbered (non-manual) migrations vs `manual/` subdirectory**. ADR-017
   and triggers-manifest place them under `packages/db/src/migrations/` (not `manual/`) with
   numbered names. However, since `drizzle-kit migrate` will try to apply any `.sql` files it
   finds in the migrations directory, placing non-Drizzle-generated files there could confuse
   Drizzle. The current approach (inline in the script, not a file at `0025`) avoids this. The
   implementation agent should clarify whether to create `0025` and `0026` as real files in
   `src/migrations/` (and accept that Drizzle would attempt to run them) or keep them only in
   `manual/` with a renaming. This is a decision point for the user.
