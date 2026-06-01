-- =============================================================================
-- 008-bookmark.indexes.sql
-- Consolidates:
--   0019_user_bookmarks_entity_active_index.sql             (compound index)
--   0020_user_bookmark_collections_unique_active_name.sql   (partial unique index)
--
-- Idempotency:
--   Both DO blocks guard against missing tables and existing indexes via
--   pg_indexes before executing the DDL.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0019: Compound index on user_bookmarks(entity_id, entity_type, deleted_at)
-- Required by SPEC-098: bookmark count endpoint + "Most saved" sort.
-- Note: Drizzle schema also declares this index on the model so a fresh
-- drizzle-kit push will pick it up. This file exists as defensive enforcement
-- for environments created before the schema change. IF NOT EXISTS = no-op.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'user_bookmarks'
  ) THEN
    RAISE NOTICE 'Table user_bookmarks does not exist, skipping idx_user_bookmarks_entity_active.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'user_bookmarks'
      AND indexname = 'idx_user_bookmarks_entity_active'
  ) THEN
    EXECUTE $sql$
      CREATE INDEX idx_user_bookmarks_entity_active
        ON user_bookmarks (entity_id, entity_type, deleted_at)
    $sql$;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 0020: Partial unique index on user_bookmark_collections(user_id, name)
-- WHERE deleted_at IS NULL.
-- Enforces one active (non-deleted) collection name per user. Soft-deleted
-- collections are excluded so names can be reused after deletion.
-- Drizzle-kit does NOT support partial indexes (WHERE clause), so this must
-- live here as a manual migration.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'user_bookmark_collections'
  ) THEN
    RAISE NOTICE 'Table user_bookmark_collections does not exist, skipping unique_user_bookmark_collections_userid_name_active.';
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
