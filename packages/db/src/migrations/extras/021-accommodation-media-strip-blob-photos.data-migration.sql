-- =============================================================================
-- 021-accommodation-media-strip-blob-photos.data-migration.sql
--
-- Purpose:
--   Strip the retired photo keys from the legacy `accommodations.media` JSONB
--   column (SPEC-204, T-026). After the gallery cutover, `accommodation_media`
--   is the SOLE source of truth for photos; the JSONB blob must shrink to
--   videos-only.
--
--   Removes these keys from `accommodations.media`:
--     featuredImage    → moved to accommodation_media (is_featured=true)
--     gallery          → moved to accommodation_media (is_featured=false)
--     archivedGallery  → moved to accommodation_media (state='archived')
--
--   Keeps:
--     videos           → stays in the JSONB blob (SPEC-204 D1 decision).
--
--   Photos were already backfilled into accommodation_media by
--   019-accommodation-media-backfill.data-migration.sql. This migration only
--   removes the now-duplicated keys from the blob. The API response keeps
--   composing media.featuredImage / media.gallery from the relational table
--   (composeAccommodationMedia), so read clients are unaffected by this strip.
--
-- Idempotency:
--   Two layers:
--   1. Table-existence check — skips silently if `accommodations` does not exist.
--   2. The JSONB `-` operator is a no-op on rows that don't have the key, and the
--      WHERE clause only touches rows that still carry at least one retired key.
--      Re-running after a full strip updates nothing.
--
-- Runs via:
--   pnpm db:apply-extras   (local dev, staging deploy, prod deploy)
--
-- NEVER run drizzle-kit push against staging/prod — see packages/db/CLAUDE.md.
-- =============================================================================

DO $$
DECLARE
    updated_count integer := 0;
BEGIN
    -- -------------------------------------------------------------------------
    -- Guard: skip silently if the accommodations table doesn't exist yet.
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'accommodations'
    ) THEN
        RAISE NOTICE '021: accommodations table does not exist, skipping strip.';
        RETURN;
    END IF;

    -- -------------------------------------------------------------------------
    -- Strip the retired photo keys, keeping `videos` intact.
    -- The WHERE clause makes the migration idempotent: once stripped, a row no
    -- longer matches and is left untouched on re-run.
    -- -------------------------------------------------------------------------
    UPDATE accommodations
    SET media = media - 'featuredImage' - 'gallery' - 'archivedGallery'
    WHERE media IS NOT NULL
      AND (
          media ? 'featuredImage'
          OR media ? 'gallery'
          OR media ? 'archivedGallery'
      );

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '021: stripped retired photo keys from % accommodation row(s).', updated_count;
END;
$$;
