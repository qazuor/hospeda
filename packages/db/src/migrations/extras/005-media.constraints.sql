-- =============================================================================
-- 005-media.constraints.sql
-- Consolidates:
--   0011_media_nullability_and_shape.sql  (A-part only: JSONB shape CHECK constraints)
--   0012_gallery_max_check.sql             (gallery max-50 CHECK constraints)
--
-- EXCLUDED from 0011:
--   The DROP NOT NULL statements on posts.media and destinations.media (Steps 1
--   and 2 of 0011) are obsolete — the baseline already declares these columns as
--   nullable. Applying them would be a no-op but including them could cause
--   confusion. They are intentionally omitted here.
--
-- Idempotency:
--   All blocks use DO $$ ... IF NOT EXISTS ... $$ guards on pg_constraint
--   before executing ALTER TABLE. Missing tables are silently skipped.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0011 (A-part): JSONB shape CHECK constraints (media IS NULL OR object)
-- ---------------------------------------------------------------------------

-- accommodations.media shape
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'accommodations'
  ) THEN
    RAISE NOTICE 'Table accommodations does not exist, skipping chk_accommodations_media_shape.';
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

-- destinations.media shape
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'destinations'
  ) THEN
    RAISE NOTICE 'Table destinations does not exist, skipping chk_destinations_media_shape.';
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

-- events.media shape
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'events'
  ) THEN
    RAISE NOTICE 'Table events does not exist, skipping chk_events_media_shape.';
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

-- posts.media shape
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'posts'
  ) THEN
    RAISE NOTICE 'Table posts does not exist, skipping chk_posts_media_shape.';
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

-- post_sponsors: no `media` column exists (column is `logo` with type Image).
-- chk_post_sponsors_media_shape is intentionally skipped.

-- ---------------------------------------------------------------------------
-- 0012: gallery max-50 CHECK constraints (media->'gallery' array length <= 50)
-- ---------------------------------------------------------------------------

-- accommodations gallery max
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'accommodations'
  ) THEN
    RAISE NOTICE 'Table accommodations does not exist, skipping chk_accommodations_gallery_max.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_accommodations_gallery_max'
      AND conrelid = 'accommodations'::regclass
  ) THEN
    ALTER TABLE accommodations
      ADD CONSTRAINT chk_accommodations_gallery_max
      CHECK (
        media IS NULL
        OR media->'gallery' IS NULL
        OR jsonb_array_length(media->'gallery') <= 50
      );
    RAISE NOTICE 'Constraint chk_accommodations_gallery_max added.';
  ELSE
    RAISE NOTICE 'Constraint chk_accommodations_gallery_max already exists, skipping.';
  END IF;
END;
$$;

-- destinations gallery max
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'destinations'
  ) THEN
    RAISE NOTICE 'Table destinations does not exist, skipping chk_destinations_gallery_max.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_destinations_gallery_max'
      AND conrelid = 'destinations'::regclass
  ) THEN
    ALTER TABLE destinations
      ADD CONSTRAINT chk_destinations_gallery_max
      CHECK (
        media IS NULL
        OR media->'gallery' IS NULL
        OR jsonb_array_length(media->'gallery') <= 50
      );
    RAISE NOTICE 'Constraint chk_destinations_gallery_max added.';
  ELSE
    RAISE NOTICE 'Constraint chk_destinations_gallery_max already exists, skipping.';
  END IF;
END;
$$;

-- events gallery max
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'events'
  ) THEN
    RAISE NOTICE 'Table events does not exist, skipping chk_events_gallery_max.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_events_gallery_max'
      AND conrelid = 'events'::regclass
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT chk_events_gallery_max
      CHECK (
        media IS NULL
        OR media->'gallery' IS NULL
        OR jsonb_array_length(media->'gallery') <= 50
      );
    RAISE NOTICE 'Constraint chk_events_gallery_max added.';
  ELSE
    RAISE NOTICE 'Constraint chk_events_gallery_max already exists, skipping.';
  END IF;
END;
$$;

-- posts gallery max
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'posts'
  ) THEN
    RAISE NOTICE 'Table posts does not exist, skipping chk_posts_gallery_max.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_posts_gallery_max'
      AND conrelid = 'posts'::regclass
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT chk_posts_gallery_max
      CHECK (
        media IS NULL
        OR media->'gallery' IS NULL
        OR jsonb_array_length(media->'gallery') <= 50
      );
    RAISE NOTICE 'Constraint chk_posts_gallery_max added.';
  ELSE
    RAISE NOTICE 'Constraint chk_posts_gallery_max already exists, skipping.';
  END IF;
END;
$$;
