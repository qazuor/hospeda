-- =============================================================================
-- 0025_users_profile_completion_flags.sql
-- Purpose: Add two boolean state flags to the users table for the profile
--          completion flow (SPEC-113) and backfill them for existing rows so
--          legacy users are grandfathered out of both prompts:
--            - profile_completed  boolean NOT NULL DEFAULT false
--            - set_password_prompted  boolean NOT NULL DEFAULT false
-- Depends on: users table must exist; `account` table must exist (referenced
--             by the set_password_prompted backfill).
-- Related: SPEC-113 Phase 0 (T-113-01). Absorbs SPEC-103 T-094 scope.
-- Date: 2026-05-15
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Column additions (idempotent).
-- The columns are also declared in user.dbschema.ts; drizzle-kit push will
-- create them on dev DBs. This block exists so apply-postgres-extras.sh stays
-- the canonical place to bring any DB up to current shape (and so prod/staging
-- can be advanced without a separate push step).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    RAISE NOTICE 'Table users does not exist, skipping profile completion flags migration.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'profile_completed'
  ) THEN
    ALTER TABLE users ADD COLUMN profile_completed boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'set_password_prompted'
  ) THEN
    ALTER TABLE users ADD COLUMN set_password_prompted boolean NOT NULL DEFAULT false;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Backfill: profile_completed
-- Grandfather any existing user that already has a non-empty `display_name`.
-- Better Auth maps its virtual `name` field to the `display_name` column
-- (see apps/api/src/lib/auth.ts: user.fields.name = 'displayName'), so a
-- non-empty display_name is what the spec means by "name is set". These
-- users have visible identity in the UI already; the completion form would
-- only repeat work for them.
-- ---------------------------------------------------------------------------
UPDATE users
SET profile_completed = TRUE
WHERE profile_completed = FALSE
  AND display_name IS NOT NULL
  AND display_name <> '';

-- ---------------------------------------------------------------------------
-- Backfill: set_password_prompted
-- Any user that already has a `credential` provider account row has a
-- password set, so the OAuth-only prompt would never apply to them.
-- ---------------------------------------------------------------------------
UPDATE users u
SET set_password_prompted = TRUE
WHERE u.set_password_prompted = FALSE
  AND EXISTS (
    SELECT 1
    FROM account a
    WHERE a.user_id = u.id
      AND a.provider_id = 'credential'
  );
