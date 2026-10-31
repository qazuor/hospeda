-- =============================================================================
-- 032-venue-experience-media.constraints.sql (carril 2, idempotent)
-- DB-level invariants for venue_media and experience_media (HOS-372).
--
-- Drizzle cannot emit a partial unique index nor a cross-column CHECK, so they
-- live in extras/ and are re-applied by `pnpm db:apply-extras` after every
-- `pnpm db:migrate`. Both tables are created by the structural migration
-- 0071_nervous_rogue.sql (carril 1).
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
-- Note on invariant 2 for venue and experience: no flow of either archives
-- photos today (their plans carry `limits: []`, so there is no downgrade-over-limit
-- remediation like the accommodation one). The CHECK is still declared so the
-- three verticals share one shape and an archive flow added later cannot
-- silently violate the featured invariant.
--
-- Idempotency:
--   Each block checks that its table exists and RAISES an exception when it
--   does not (HOS-1794): a silent skip left the invariant absent while
--   `db:apply-extras` exited 0. The structural migration must run first
--   (`pnpm db:migrate` before `pnpm db:apply-extras`). Once the table exists,
--   DROP/CREATE INDEX IF [NOT] EXISTS and pg_constraint lookups make re-applying
--   a no-op.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- venue_media — Invariant 1: at most one featured photo per listing
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'venue_media'
  ) THEN
    RAISE EXCEPTION 'extras/032: table % does not exist, cannot ensure uq_venue_media_single_featured. Run pnpm db:migrate before pnpm db:apply-extras.', 'venue_media';
  END IF;

  -- Drop first so we can recreate with the updated predicate (idempotent).
  DROP INDEX IF EXISTS uq_venue_media_single_featured;
  CREATE UNIQUE INDEX uq_venue_media_single_featured
    ON venue_media (venue_id)
    WHERE is_featured = true AND deleted_at IS NULL;
  RAISE NOTICE 'uq_venue_media_single_featured: ensured.';
END;
$$;

-- ---------------------------------------------------------------------------
-- venue_media — Invariant 2: a featured photo cannot be archived
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'venue_media'
  ) THEN
    RAISE EXCEPTION 'extras/032: table % does not exist, cannot ensure chk_venue_media_featured_not_archived. Run pnpm db:migrate before pnpm db:apply-extras.', 'venue_media';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname  = 'chk_venue_media_featured_not_archived'
      AND conrelid = 'venue_media'::regclass
  ) THEN
    ALTER TABLE venue_media
      ADD CONSTRAINT chk_venue_media_featured_not_archived
      CHECK (NOT (is_featured AND state = 'archived'));
    RAISE NOTICE 'chk_venue_media_featured_not_archived: added.';
  ELSE
    RAISE NOTICE 'chk_venue_media_featured_not_archived: already exists, skipping.';
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
    RAISE EXCEPTION 'extras/032: table % does not exist, cannot ensure uq_experience_media_single_featured. Run pnpm db:migrate before pnpm db:apply-extras.', 'experience_media';
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
    RAISE EXCEPTION 'extras/032: table % does not exist, cannot ensure chk_experience_media_featured_not_archived. Run pnpm db:migrate before pnpm db:apply-extras.', 'experience_media';
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
