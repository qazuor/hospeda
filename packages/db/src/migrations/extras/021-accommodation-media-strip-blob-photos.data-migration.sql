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
    -- Guard: skip silently unless the `accommodations.media` COLUMN exists.
    --
    -- Guarding on the TABLE is not enough (HOS-372). The table outlives the
    -- column: once the cutover drops `media`, the UPDATE below references a
    -- column that no longer exists, this whole DO block raises, and because
    -- `db:apply-extras` runs the files as one batch, EVERY later extras file is
    -- skipped too. Guarding on the column makes this a clean no-op instead.
    --
    -- Returning early is what keeps that safe: PL/pgSQL plans a statement on its
    -- FIRST EXECUTION, not when the block is entered, so the UPDATE is never
    -- planned and never resolves the missing column. Verified against a real
    -- database, not assumed.
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'accommodations'
          AND column_name = 'media'
    ) THEN
        RAISE NOTICE '021: accommodations.media column does not exist, skipping strip.';
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
