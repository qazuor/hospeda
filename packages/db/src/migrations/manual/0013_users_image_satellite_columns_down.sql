-- =============================================================================
-- 0013_users_image_satellite_columns_down.sql
-- Purpose: Roll back 0013_users_image_satellite_columns.sql.
--          Drops the satellite columns and associated index added to the users
--          table for Cloudinary image metadata.
-- WARNING: This is destructive — any data stored in these columns will be lost.
--          Only run this in development/staging environments.
-- Related GAPs: GAP-078-081, GAP-078-197 (SPEC-078-GAPS T-014)
-- Date: 2026-04-18
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    RAISE NOTICE 'Table users does not exist, nothing to roll back.';
    RETURN;
  END IF;

  -- Drop the moderation-state index first (avoids dependency errors).
  DROP INDEX IF EXISTS public.users_image_moderation_state_idx;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'image_public_id'
  ) THEN
    ALTER TABLE users DROP COLUMN image_public_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'image_moderation_state'
  ) THEN
    ALTER TABLE users DROP COLUMN image_moderation_state;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'image_caption'
  ) THEN
    ALTER TABLE users DROP COLUMN image_caption;
  END IF;
END;
$$;
