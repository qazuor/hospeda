-- =============================================================================
-- 0011_media_nullability_and_shape.sql
-- Purpose:
--   1. Drop NOT NULL constraint from posts.media and destinations.media
--      (GAP-078-184, GAP-078-180, GAP-078-080). These columns were declared
--      NOT NULL but the domain allows draft entities with no media. The Drizzle
--      schema has been updated to $type<Media | null>() (no .notNull()).
--   2. Add a CHECK constraint on every entity table that carries a media JSONB
--      column (accommodations, destinations, events, posts, post_sponsors)
--      to enforce that the column is either NULL or a JSON object, never a
--      scalar or array (GAP-078-075).
--
-- Depends on: tables accommodations, destinations, events, posts, post_sponsors
--             must exist.
-- Idempotent: each step checks existence before applying the DDL.
-- Date: 2026-04-18
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Drop NOT NULL from posts.media
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'posts'
  ) THEN
    -- Check whether the column is currently NOT NULL
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'posts'
        AND column_name  = 'media'
        AND is_nullable  = 'NO'
    ) THEN
      ALTER TABLE posts ALTER COLUMN media DROP NOT NULL;
      RAISE NOTICE 'posts.media: NOT NULL dropped.';
    ELSE
      RAISE NOTICE 'posts.media: already nullable, skipping.';
    END IF;
  ELSE
    RAISE NOTICE 'Table posts does not exist, skipping media nullability fix.';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- Step 2: Drop NOT NULL from destinations.media
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
        AND is_nullable  = 'NO'
    ) THEN
      ALTER TABLE destinations ALTER COLUMN media DROP NOT NULL;
      RAISE NOTICE 'destinations.media: NOT NULL dropped.';
    ELSE
      RAISE NOTICE 'destinations.media: already nullable, skipping.';
    END IF;
  ELSE
    RAISE NOTICE 'Table destinations does not exist, skipping media nullability fix.';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- Step 3: ADD CHECK chk_accommodations_media_shape
-- Ensures accommodations.media is NULL or a JSON object.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'accommodations'
  ) THEN
    RAISE NOTICE 'Table accommodations does not exist, skipping media shape check.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname    = 'chk_accommodations_media_shape'
      AND conrelid   = 'accommodations'::regclass
  ) THEN
    ALTER TABLE accommodations
      ADD CONSTRAINT chk_accommodations_media_shape
      CHECK (media IS NULL OR jsonb_typeof(media) = 'object');
    RAISE NOTICE 'chk_accommodations_media_shape: added.';
  ELSE
    RAISE NOTICE 'chk_accommodations_media_shape: already exists, skipping.';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- Step 4: ADD CHECK chk_destinations_media_shape
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'destinations'
  ) THEN
    RAISE NOTICE 'Table destinations does not exist, skipping media shape check.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname    = 'chk_destinations_media_shape'
      AND conrelid   = 'destinations'::regclass
  ) THEN
    ALTER TABLE destinations
      ADD CONSTRAINT chk_destinations_media_shape
      CHECK (media IS NULL OR jsonb_typeof(media) = 'object');
    RAISE NOTICE 'chk_destinations_media_shape: added.';
  ELSE
    RAISE NOTICE 'chk_destinations_media_shape: already exists, skipping.';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- Step 5: ADD CHECK chk_events_media_shape
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'events'
  ) THEN
    RAISE NOTICE 'Table events does not exist, skipping media shape check.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname    = 'chk_events_media_shape'
      AND conrelid   = 'events'::regclass
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT chk_events_media_shape
      CHECK (media IS NULL OR jsonb_typeof(media) = 'object');
    RAISE NOTICE 'chk_events_media_shape: added.';
  ELSE
    RAISE NOTICE 'chk_events_media_shape: already exists, skipping.';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- Step 6: ADD CHECK chk_posts_media_shape
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'posts'
  ) THEN
    RAISE NOTICE 'Table posts does not exist, skipping media shape check.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname    = 'chk_posts_media_shape'
      AND conrelid   = 'posts'::regclass
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT chk_posts_media_shape
      CHECK (media IS NULL OR jsonb_typeof(media) = 'object');
    RAISE NOTICE 'chk_posts_media_shape: added.';
  ELSE
    RAISE NOTICE 'chk_posts_media_shape: already exists, skipping.';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- Step 7: ADD CHECK chk_post_sponsors_media_shape
-- Note: the column in post_sponsors is "logo" (Image, not Media). However,
-- the table referenced in GAP-078-075 is "post_sponsors" and the task
-- specification names it "post_sponsor". The actual schema column is `logo`
-- (jsonb, Image type). There is no `media` column on post_sponsors.
-- This step is intentionally a no-op with a NOTICE so future developers
-- are not confused by the discrepancy.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE 'post_sponsors: no `media` column exists (column is `logo` with type Image). chk_post_sponsors_media_shape skipped intentionally.';
END;
$$;
