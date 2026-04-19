-- =============================================================================
-- 0012_gallery_max_check.sql
-- Purpose: Add CHECK constraints to accommodations, destinations, events, and
--          posts enforcing a maximum of 50 items in media->'gallery' JSONB array.
--          Drizzle's .check() builder cannot express jsonb_array_length() over a
--          nested JSONB path, so this constraint must be applied manually.
-- Gap:     GAP-078-195
-- Depends on: accommodations, destinations, events, posts tables must exist.
-- Related:    GAP-078-071 (server-side 422 cap), GAP-078-294 (upload route cap)
-- Date: 2026-04-18
-- =============================================================================

-- Helper: apply a gallery-max constraint idempotently to a single table.
-- The expression passes when:
--   - media IS NULL                                     (no JSONB stored)
--   - media->'gallery' IS NULL                          (no gallery key)
--   - jsonb_array_length(media->'gallery') <= 50        (within limit)

-- ─── accommodations ───────────────────────────────────────────────────────────
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

-- ─── destinations ─────────────────────────────────────────────────────────────
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

-- ─── events ───────────────────────────────────────────────────────────────────
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

-- ─── posts ────────────────────────────────────────────────────────────────────
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
