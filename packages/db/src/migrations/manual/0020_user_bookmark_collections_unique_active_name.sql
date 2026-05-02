-- =============================================================================
-- 0020_user_bookmark_collections_unique_active_name.sql
-- Purpose: Partial unique index on `user_bookmark_collections(user_id, name)`
--          WHERE deleted_at IS NULL.
--
--          Enforces that a user cannot have two active (non-deleted) bookmark
--          collections with the same name. Soft-deleted collections are excluded
--          so that names can be reused after deletion.
--
--          Drizzle-kit push/generate does NOT support partial indexes (indexes
--          with a WHERE clause), so this constraint cannot be declared in the
--          Drizzle schema DSL and must live here as a manual migration.
--
-- Idempotent — safe to re-run: uses IF NOT EXISTS checks against pg_indexes.
--
-- Depends on: user_bookmark_collections table (created by T-005 / drizzle-kit push).
-- Date: 2026-05-02
-- Spec: SPEC-098 (T-008)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Partial unique index: one active collection name per user
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'user_bookmark_collections'
  ) THEN
    RAISE NOTICE 'Table user_bookmark_collections does not exist, skipping unique_active_name index.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'user_bookmark_collections'
      AND indexname = 'unique_user_bookmark_collections_userid_name_active'
  ) THEN
    CREATE UNIQUE INDEX unique_user_bookmark_collections_userid_name_active
      ON user_bookmark_collections (user_id, name)
      WHERE deleted_at IS NULL;
    RAISE NOTICE 'Created index unique_user_bookmark_collections_userid_name_active.';
  END IF;
END;
$$;
