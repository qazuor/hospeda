-- =============================================================================
-- 033-content-media.constraints.sql (carril 2, idempotent)
-- DB-level invariants for post_media and event_media (HOS-390).
--
-- Drizzle cannot emit a partial unique index nor a cross-column CHECK, so they
-- live in extras/ and are re-applied by `pnpm db:apply-extras` after every
-- `pnpm db:migrate`. Both tables are created by the structural migration
-- 0075_absurd_adam_warlock.sql (carril 1).
--
-- Mirrors 032-commerce-media.constraints.sql (and 018 before it) exactly, one
-- block pair per entity. Posts and events are separate tables, not one
-- polymorphic table, so each needs its own index and CHECK — the deliberate
-- cost of having the DATABASE guarantee the invariant per content type.
--
-- Invariants (per table):
--   1. At most ONE featured photo per post/event
--      -> partial unique index on (<fk>) WHERE is_featured AND NOT deleted.
--   2. A featured photo can never be archived
--      -> CHECK NOT (is_featured AND state = 'archived').
--
-- Note on invariant 2 here: no editorial flow archives photos today (only the
-- accommodation plan-downgrade remediation does, SPEC-167, and posts/events
-- have no plan). The CHECK is declared anyway so all four media tables share
-- one shape and an archive flow added later cannot silently violate the
-- featured invariant.
--
-- Idempotency:
--   Each block guards on table existence first (skips silently on a fresh DB
--   where the structural migration has not run yet), then uses IF NOT EXISTS /
--   pg_constraint lookups so re-applying is a no-op.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- post_media — Invariant 1: at most one featured photo per post
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'post_media'
  ) THEN
    RAISE NOTICE 'Table post_media does not exist, skipping uq_post_media_single_featured.';
    RETURN;
  END IF;

  -- Drop first so we can recreate with the updated predicate (idempotent).
  DROP INDEX IF EXISTS uq_post_media_single_featured;
  CREATE UNIQUE INDEX uq_post_media_single_featured
    ON post_media (post_id)
    WHERE is_featured = true AND deleted_at IS NULL;
  RAISE NOTICE 'uq_post_media_single_featured: ensured.';
END;
$$;

-- ---------------------------------------------------------------------------
-- post_media — Invariant 2: a featured photo cannot be archived
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'post_media'
  ) THEN
    RAISE NOTICE 'Table post_media does not exist, skipping chk_post_media_featured_not_archived.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname  = 'chk_post_media_featured_not_archived'
      AND conrelid = 'post_media'::regclass
  ) THEN
    ALTER TABLE post_media
      ADD CONSTRAINT chk_post_media_featured_not_archived
      CHECK (NOT (is_featured AND state = 'archived'));
    RAISE NOTICE 'chk_post_media_featured_not_archived: added.';
  ELSE
    RAISE NOTICE 'chk_post_media_featured_not_archived: already exists, skipping.';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- event_media — Invariant 1: at most one featured photo per event
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'event_media'
  ) THEN
    RAISE NOTICE 'Table event_media does not exist, skipping uq_event_media_single_featured.';
    RETURN;
  END IF;

  -- Drop first so we can recreate with the updated predicate (idempotent).
  DROP INDEX IF EXISTS uq_event_media_single_featured;
  CREATE UNIQUE INDEX uq_event_media_single_featured
    ON event_media (event_id)
    WHERE is_featured = true AND deleted_at IS NULL;
  RAISE NOTICE 'uq_event_media_single_featured: ensured.';
END;
$$;

-- ---------------------------------------------------------------------------
-- event_media — Invariant 2: a featured photo cannot be archived
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'event_media'
  ) THEN
    RAISE NOTICE 'Table event_media does not exist, skipping chk_event_media_featured_not_archived.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname  = 'chk_event_media_featured_not_archived'
      AND conrelid = 'event_media'::regclass
  ) THEN
    ALTER TABLE event_media
      ADD CONSTRAINT chk_event_media_featured_not_archived
      CHECK (NOT (is_featured AND state = 'archived'));
    RAISE NOTICE 'chk_event_media_featured_not_archived: added.';
  ELSE
    RAISE NOTICE 'chk_event_media_featured_not_archived: already exists, skipping.';
  END IF;
END;
$$;
