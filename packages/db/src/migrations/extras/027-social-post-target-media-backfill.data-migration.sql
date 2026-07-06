-- =============================================================================
-- 027-social-post-target-media-backfill.data-migration.sql
--
-- Purpose:
--   Fan out existing social_post_media rows into social_post_target_media
--   (HOS-65 T-003/T-004/T-005). Before this table existed, a post's media
--   pool was implicitly shared by every one of its publish targets with no
--   explicit link row. This migration creates one social_post_target_media
--   row per (target, media) pair for every social_post_targets row that
--   belongs to the same social_posts row as the media — a genuine fan-out:
--   1 media row on an N-target post produces N link rows, each preserving
--   the media's original `position` as its initial per-target position.
--   There is no single-vs-multi-target special case; every target gets its
--   own link row for every media item on its post.
--
-- Idempotency:
--   INSERT ... ON CONFLICT (social_post_target_id, social_post_media_id)
--   DO NOTHING is a no-op once a link row already exists for a given pair,
--   so this file is safe to re-apply by `pnpm db:apply-extras` on every
--   deploy (including on environments where the backfill already ran).
--
-- Runs via:
--   pnpm db:apply-extras   (local dev, staging deploy, prod deploy)
--
-- NEVER run drizzle-kit push against staging/prod — see packages/db/CLAUDE.md.
-- =============================================================================

DO $$
DECLARE
  inserted_rows integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'social_post_target_media'
  ) THEN
    RAISE NOTICE 'Table social_post_target_media does not exist, skipping 027-social-post-target-media-backfill migration.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'social_post_media'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'social_post_targets'
  ) THEN
    RAISE NOTICE 'Table social_post_media or social_post_targets does not exist, skipping 027-social-post-target-media-backfill migration.';
    RETURN;
  END IF;

  INSERT INTO social_post_target_media (social_post_target_id, social_post_media_id, position)
  SELECT spt.id, spm.id, spm.position
  FROM social_post_media spm
  JOIN social_post_targets spt ON spt.social_post_id = spm.social_post_id
  ON CONFLICT (social_post_target_id, social_post_media_id) DO NOTHING;

  GET DIAGNOSTICS inserted_rows = ROW_COUNT;
  RAISE NOTICE '027-social-post-target-media-backfill: inserted % row(s) into social_post_target_media.',
               inserted_rows;
END;
$$;
