-- =============================================================================
-- 0025_users_profile_completion_flags_down.sql
-- Purpose: Reverse 0025_users_profile_completion_flags.sql by dropping the two
--          flag columns. The backfilled state is lost on rollback — that is
--          acceptable since the flags can be recomputed from display_name and
--          the account table on the next forward apply.
-- Usage: applied only via ad-hoc rollback procedures, NOT chained into
--        apply-postgres-extras.sh (the script skips *_down.sql files).
-- Date: 2026-05-15
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'set_password_prompted'
  ) THEN
    ALTER TABLE users DROP COLUMN set_password_prompted;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'profile_completed'
  ) THEN
    ALTER TABLE users DROP COLUMN profile_completed;
  END IF;
END;
$$;
