-- =============================================================================
-- 0027_newsletter_subscribers_user_id_nullable_down.sql
-- Purpose: Reverse 0027_newsletter_subscribers_user_id_nullable.sql.
--          Restoring NOT NULL requires that no rows currently have user_id IS NULL.
--          Anonymous (guest) subscriber rows would block this — they would need to
--          be either linked (via the post-signup hook) or hard-deleted first.
--          The script raises NOTICE without failing the run if such rows exist
--          so an operator can deal with them deliberately.
-- Usage: ad-hoc rollback only. apply-postgres-extras.sh skips *_down.sql files.
-- Date: 2026-05-20
-- =============================================================================

DO $$
DECLARE
    anon_count integer;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'newsletter_subscribers'
    ) THEN
        RETURN;
    END IF;

    SELECT COUNT(*) INTO anon_count
    FROM newsletter_subscribers
    WHERE user_id IS NULL;

    IF anon_count > 0 THEN
        RAISE NOTICE 'Cannot restore NOT NULL on newsletter_subscribers.user_id: % rows still have NULL user_id. Resolve them first (link or hard-delete) and re-run.', anon_count;
        RETURN;
    END IF;

    ALTER TABLE newsletter_subscribers ALTER COLUMN user_id SET NOT NULL;
END;
$$;
