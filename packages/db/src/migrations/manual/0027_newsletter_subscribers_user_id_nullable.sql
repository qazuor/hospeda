-- =============================================================================
-- 0027_newsletter_subscribers_user_id_nullable.sql
-- Purpose: Allow anonymous (guest) newsletter subscribers by dropping the
--          NOT NULL constraint on `newsletter_subscribers.user_id`. Once a
--          guest signs up, the post-signup hook calls
--          `NewsletterSubscriberService.linkAnonymousSubscribersToUser` which
--          fills in `user_id` and (when the account email is already verified)
--          promotes the row from pending_verification to active.
-- Idempotent: ALTER COLUMN ... DROP NOT NULL is itself a no-op if the column
--             is already nullable, but we still wrap it in a guard so the
--             script tolerates partial prior runs.
-- Related:   The partial UNIQUE on (user_id, channel) WHERE deleted_at IS NULL
--            from migration 0022 still applies — NULLs are not considered
--            equal by PostgreSQL, so multiple anonymous rows for different
--            emails coexist without conflict. The guest subscribe flow itself
--            de-duplicates by `email + channel` before INSERT.
-- Date: 2026-05-20
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'newsletter_subscribers'
    ) THEN
        RAISE NOTICE 'Table newsletter_subscribers does not exist, skipping user_id nullable migration.';
        RETURN;
    END IF;

    -- Information_schema reports YES/NO; drop the constraint only when it
    -- is still NOT NULL so re-runs are cheap.
    IF (
        SELECT is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'newsletter_subscribers'
          AND column_name = 'user_id'
    ) = 'NO' THEN
        ALTER TABLE newsletter_subscribers ALTER COLUMN user_id DROP NOT NULL;
    END IF;
END;
$$;
