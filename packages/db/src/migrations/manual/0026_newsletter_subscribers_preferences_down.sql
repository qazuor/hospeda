-- =============================================================================
-- 0026_newsletter_subscribers_preferences_down.sql
-- Purpose: Reverse 0026_newsletter_subscribers_preferences.sql by dropping
--          the `preferences` column. The per-user choices are lost on rollback;
--          re-applying the forward migration restores the all-true default.
-- Usage: ad-hoc rollback only. apply-postgres-extras.sh skips *_down.sql files.
-- Date: 2026-05-20
-- =============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'newsletter_subscribers'
          AND column_name = 'preferences'
    ) THEN
        ALTER TABLE newsletter_subscribers DROP COLUMN preferences;
    END IF;
END;
$$;
