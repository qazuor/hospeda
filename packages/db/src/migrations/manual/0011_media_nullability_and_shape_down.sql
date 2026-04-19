-- =============================================================================
-- 0011_media_nullability_and_shape_down.sql
-- Purpose: Rollback for 0011_media_nullability_and_shape.sql.
--   1. Re-adds NOT NULL to posts.media and destinations.media.
--      WARNING: This will fail if any row has media = NULL. Ensure all rows
--      have a non-null value before running (e.g. UPDATE posts SET media = '{}'
--      WHERE media IS NULL).
--   2. Drops the media shape CHECK constraints from all 5 entity tables.
-- Date: 2026-04-18
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Restore NOT NULL on posts.media
-- IMPORTANT: Run `UPDATE posts SET media = '{}' WHERE media IS NULL;` first.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'posts'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'posts'
        AND column_name  = 'media'
        AND is_nullable  = 'YES'
    ) THEN
      ALTER TABLE posts ALTER COLUMN media SET NOT NULL;
      RAISE NOTICE 'posts.media: NOT NULL restored.';
    ELSE
      RAISE NOTICE 'posts.media: already NOT NULL, skipping.';
    END IF;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- Step 2: Restore NOT NULL on destinations.media
-- IMPORTANT: Run `UPDATE destinations SET media = '{}' WHERE media IS NULL;` first.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'destinations'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'destinations'
        AND column_name  = 'media'
        AND is_nullable  = 'YES'
    ) THEN
      ALTER TABLE destinations ALTER COLUMN media SET NOT NULL;
      RAISE NOTICE 'destinations.media: NOT NULL restored.';
    ELSE
      RAISE NOTICE 'destinations.media: already NOT NULL, skipping.';
    END IF;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- Step 3: Drop CHECK constraints (idempotent — no error if they don't exist)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname  = 'chk_accommodations_media_shape'
      AND conrelid = 'accommodations'::regclass
  ) THEN
    ALTER TABLE accommodations DROP CONSTRAINT chk_accommodations_media_shape;
    RAISE NOTICE 'chk_accommodations_media_shape: dropped.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname  = 'chk_destinations_media_shape'
      AND conrelid = 'destinations'::regclass
  ) THEN
    ALTER TABLE destinations DROP CONSTRAINT chk_destinations_media_shape;
    RAISE NOTICE 'chk_destinations_media_shape: dropped.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname  = 'chk_events_media_shape'
      AND conrelid = 'events'::regclass
  ) THEN
    ALTER TABLE events DROP CONSTRAINT chk_events_media_shape;
    RAISE NOTICE 'chk_events_media_shape: dropped.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname  = 'chk_posts_media_shape'
      AND conrelid = 'posts'::regclass
  ) THEN
    ALTER TABLE posts DROP CONSTRAINT chk_posts_media_shape;
    RAISE NOTICE 'chk_posts_media_shape: dropped.';
  END IF;
END;
$$;
