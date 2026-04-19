-- =============================================================================
-- 0012_gallery_max_check_down.sql
-- Purpose: Rollback for 0012_gallery_max_check.sql. Drops the gallery-max
--          CHECK constraints from accommodations, destinations, events, posts.
-- Date: 2026-04-18
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_accommodations_gallery_max'
      AND conrelid = 'accommodations'::regclass
  ) THEN
    ALTER TABLE accommodations DROP CONSTRAINT chk_accommodations_gallery_max;
    RAISE NOTICE 'Dropped chk_accommodations_gallery_max.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_destinations_gallery_max'
      AND conrelid = 'destinations'::regclass
  ) THEN
    ALTER TABLE destinations DROP CONSTRAINT chk_destinations_gallery_max;
    RAISE NOTICE 'Dropped chk_destinations_gallery_max.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_events_gallery_max'
      AND conrelid = 'events'::regclass
  ) THEN
    ALTER TABLE events DROP CONSTRAINT chk_events_gallery_max;
    RAISE NOTICE 'Dropped chk_events_gallery_max.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_posts_gallery_max'
      AND conrelid = 'posts'::regclass
  ) THEN
    ALTER TABLE posts DROP CONSTRAINT chk_posts_gallery_max;
    RAISE NOTICE 'Dropped chk_posts_gallery_max.';
  END IF;
END;
$$;
