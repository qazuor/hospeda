-- =============================================================================
-- 018-accommodation-media.constraints.sql (carril 2, idempotent)
-- DB-level invariants for the accommodation_media table (SPEC-204, T-003).
--
-- Drizzle cannot emit a partial unique index nor a cross-column CHECK, so they
-- live in extras/ and are re-applied by `pnpm db:apply-extras` after every
-- `pnpm db:migrate`. The accommodation_media table itself is created by the
-- structural migration 0026_robust_marten_broadcloak.sql (carril 1).
--
-- Invariants (locked, SPEC-204 D2):
--   1. At most ONE featured photo per accommodation
--      -> partial unique index on (accommodation_id) WHERE is_featured.
--   2. A featured photo can never be archived
--      -> CHECK NOT (is_featured AND state = 'archived').
--
-- Idempotency:
--   Each block guards on table existence first (skips silently on a fresh DB
--   where the structural migration has not run yet), then uses IF NOT EXISTS /
--   pg_constraint lookups so re-applying is a no-op.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Invariant 1: at most one featured photo per accommodation
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'accommodation_media'
  ) THEN
    RAISE NOTICE 'Table accommodation_media does not exist, skipping uq_accommodation_media_single_featured.';
    RETURN;
  END IF;

  -- Drop first so we can recreate with the updated predicate (idempotent).
  DROP INDEX IF EXISTS uq_accommodation_media_single_featured;
  CREATE UNIQUE INDEX uq_accommodation_media_single_featured
    ON accommodation_media (accommodation_id)
    WHERE is_featured = true AND deleted_at IS NULL;
  RAISE NOTICE 'uq_accommodation_media_single_featured: ensured.';
END;
$$;

-- ---------------------------------------------------------------------------
-- Invariant 2: a featured photo cannot be archived
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'accommodation_media'
  ) THEN
    RAISE NOTICE 'Table accommodation_media does not exist, skipping chk_accommodation_media_featured_not_archived.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname  = 'chk_accommodation_media_featured_not_archived'
      AND conrelid = 'accommodation_media'::regclass
  ) THEN
    ALTER TABLE accommodation_media
      ADD CONSTRAINT chk_accommodation_media_featured_not_archived
      CHECK (NOT (is_featured AND state = 'archived'));
    RAISE NOTICE 'chk_accommodation_media_featured_not_archived: added.';
  ELSE
    RAISE NOTICE 'chk_accommodation_media_featured_not_archived: already exists, skipping.';
  END IF;
END;
$$;
