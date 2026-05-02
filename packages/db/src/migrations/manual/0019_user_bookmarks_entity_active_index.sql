-- =============================================================================
-- 0019_user_bookmarks_entity_active_index.sql
-- Purpose: Compound index on `user_bookmarks(entity_id, entity_type, deleted_at)`
--          required by SPEC-098. Two consumers depend on it:
--            1. The public bookmark count endpoint (`GET /api/v1/public/user-bookmarks/count`)
--            2. The "Most saved" listing sort (T-052) which aggregates active
--               bookmarks per entity.
--
--          Drizzle schema also declares this index on the model so a fresh
--          `drizzle-kit push` will pick it up. This file exists for environments
--          that were created before the schema change and for `db:fresh-dev`
--          flows that always run the extras script.
-- Depends on: user_bookmarks table.
-- Date: 2026-05-02
-- Spec: SPEC-098 (T-008 + T-052)
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'user_bookmarks'
  ) THEN
    RAISE NOTICE 'Table user_bookmarks does not exist, skipping entity_active index.';
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
