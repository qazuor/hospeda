-- =============================================================================
-- 0013_users_image_satellite_columns.sql
-- Purpose: Add three nullable satellite columns to the users table that mirror
--          the image JSONB stored in the `image` (text/URL) column, enabling
--          efficient filtering and cleanup without URL parsing at query time:
--            - image_public_id  text          -- Cloudinary public ID for direct deletion
--            - image_moderation_state  moderation_status_enum  -- moderation state for filtering
--            - image_caption  text            -- human-readable caption for the avatar
-- Depends on: users table must exist; moderation_status_enum must exist.
-- Related GAPs: GAP-078-081, GAP-078-197 (SPEC-078-GAPS T-014)
-- Date: 2026-04-18
-- =============================================================================

-- Idempotent: each column is added only if it does not already exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    RAISE NOTICE 'Table users does not exist, skipping satellite column migration.';
    RETURN;
  END IF;

  -- image_public_id: stores the Cloudinary public_id so _afterHardDelete can delete
  -- the avatar directly without parsing the URL.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'image_public_id'
  ) THEN
    ALTER TABLE users ADD COLUMN image_public_id text;
  END IF;

  -- image_moderation_state: mirrors moderationState from image JSONB metadata,
  -- typed as the existing moderation_status_enum for index-friendly filtering.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'image_moderation_state'
  ) THEN
    ALTER TABLE users ADD COLUMN image_moderation_state moderation_status_enum;
  END IF;

  -- image_caption: optional human-readable caption for the user avatar.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'image_caption'
  ) THEN
    ALTER TABLE users ADD COLUMN image_caption text;
  END IF;
END;
$$;

-- Index on image_moderation_state for moderation dashboard queries.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND indexname = 'users_image_moderation_state_idx'
  ) THEN
    CREATE INDEX users_image_moderation_state_idx ON users (image_moderation_state);
  END IF;
END;
$$;
