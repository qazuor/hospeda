-- =============================================================================
-- 032-commerce-media.constraints.sql (carril 2, idempotent)
-- DB-level invariants for gastronomy_media and experience_media (HOS-372).
--
-- Drizzle cannot emit a partial unique index nor a cross-column CHECK, so they
-- live in extras/ and are re-applied by `pnpm db:apply-extras` after every
-- `pnpm db:migrate`. Both tables are created by the structural migration
-- 0070_nervous_rogue.sql (carril 1).
--
-- Mirrors 018-accommodation-media.constraints.sql exactly, one block pair per
-- vertical. The verticals are separate tables (not one polymorphic table) so
-- each needs its own index and CHECK — that duplication is the deliberate cost
-- of having the DATABASE guarantee cascade integrity per listing type.
--
-- Invariants (per table):
--   1. At most ONE featured photo per listing
--      -> partial unique index on (<fk>) WHERE is_featured AND NOT deleted.
--   2. A featured photo can never be archived
--      -> CHECK NOT (is_featured AND state = 'archived').
--
-- Note on invariant 2 for commerce: no commerce flow archives photos today (the
-- commerce plan carries `limits: []`, so there is no downgrade-over-limit
-- remediation like the accommodation one). The CHECK is still declared so the
-- three verticals share one shape and an archive flow added later cannot
-- silently violate the featured invariant.
--
-- Idempotency:
--   Each block guards on table existence first (skips silently on a fresh DB
--   where the structural migration has not run yet), then uses IF NOT EXISTS /
--   pg_constraint lookups so re-applying is a no-op.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- gastronomy_media — Invariant 1: at most one featured photo per listing
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'gastronomy_media'
  ) THEN
    RAISE NOTICE 'Table gastronomy_media does not exist, skipping uq_gastronomy_media_single_featured.';
    RETURN;
  END IF;

  -- Drop first so we can recreate with the updated predicate (idempotent).
  DROP INDEX IF EXISTS uq_gastronomy_media_single_featured;
  CREATE UNIQUE INDEX uq_gastronomy_media_single_featured
    ON gastronomy_media (gastronomy_id)
    WHERE is_featured = true AND deleted_at IS NULL;
  RAISE NOTICE 'uq_gastronomy_media_single_featured: ensured.';
END;
$$;

-- ---------------------------------------------------------------------------
-- gastronomy_media — Invariant 2: a featured photo cannot be archived
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'gastronomy_media'
  ) THEN
    RAISE NOTICE 'Table gastronomy_media does not exist, skipping chk_gastronomy_media_featured_not_archived.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname  = 'chk_gastronomy_media_featured_not_archived'
      AND conrelid = 'gastronomy_media'::regclass
  ) THEN
    ALTER TABLE gastronomy_media
      ADD CONSTRAINT chk_gastronomy_media_featured_not_archived
      CHECK (NOT (is_featured AND state = 'archived'));
    RAISE NOTICE 'chk_gastronomy_media_featured_not_archived: added.';
  ELSE
    RAISE NOTICE 'chk_gastronomy_media_featured_not_archived: already exists, skipping.';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- experience_media — Invariant 1: at most one featured photo per listing
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'experience_media'
  ) THEN
    RAISE NOTICE 'Table experience_media does not exist, skipping uq_experience_media_single_featured.';
    RETURN;
  END IF;

  -- Drop first so we can recreate with the updated predicate (idempotent).
  DROP INDEX IF EXISTS uq_experience_media_single_featured;
  CREATE UNIQUE INDEX uq_experience_media_single_featured
    ON experience_media (experience_id)
    WHERE is_featured = true AND deleted_at IS NULL;
  RAISE NOTICE 'uq_experience_media_single_featured: ensured.';
END;
$$;

-- ---------------------------------------------------------------------------
-- experience_media — Invariant 2: a featured photo cannot be archived
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'experience_media'
  ) THEN
    RAISE NOTICE 'Table experience_media does not exist, skipping chk_experience_media_featured_not_archived.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname  = 'chk_experience_media_featured_not_archived'
      AND conrelid = 'experience_media'::regclass
  ) THEN
    ALTER TABLE experience_media
      ADD CONSTRAINT chk_experience_media_featured_not_archived
      CHECK (NOT (is_featured AND state = 'archived'));
    RAISE NOTICE 'chk_experience_media_featured_not_archived: added.';
  ELSE
    RAISE NOTICE 'chk_experience_media_featured_not_archived: already exists, skipping.';
  END IF;
END;
$$;
