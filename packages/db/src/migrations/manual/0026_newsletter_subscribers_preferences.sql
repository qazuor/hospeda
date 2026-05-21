-- =============================================================================
-- 0026_newsletter_subscribers_preferences.sql
-- Purpose: Add the `preferences` jsonb column to `newsletter_subscribers`,
--          backed by `NewsletterContentTypeEnum`. The column stores per-content
--          opt-in flags (offers / events / guides / productNews) so the campaign
--          dispatcher can segment audiences without a separate preferences table.
-- Default: all content types enabled. KEEP IN SYNC with
--          `DEFAULT_NEWSLETTER_PREFERENCES` in
--          `packages/schemas/src/enums/newsletter-content-type.enum.ts` and
--          with the `.default(DEFAULT_NEWSLETTER_PREFERENCES)` in
--          `packages/db/src/schemas/newsletter/newsletter_subscribers.dbschema.ts`.
-- Idempotent: column addition + backfill are guarded by existence checks.
-- Date: 2026-05-20
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'newsletter_subscribers'
    ) THEN
        RAISE NOTICE 'Table newsletter_subscribers does not exist, skipping preferences column migration.';
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'newsletter_subscribers'
          AND column_name = 'preferences'
    ) THEN
        ALTER TABLE newsletter_subscribers
            ADD COLUMN preferences jsonb NOT NULL
            DEFAULT '{"offers":true,"events":true,"guides":true,"productNews":true}'::jsonb;
    END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Backfill: any row whose preferences key is missing one of the four content
-- types gets it set to TRUE. Safe to re-run; rows already complete are
-- unaffected. Uses jsonb concat (||) with the missing keys only so existing
-- user choices for the other keys are preserved.
-- ---------------------------------------------------------------------------
UPDATE newsletter_subscribers
SET preferences = preferences
    || jsonb_build_object(
        'offers',      COALESCE(preferences->'offers',      to_jsonb(TRUE)),
        'events',      COALESCE(preferences->'events',      to_jsonb(TRUE)),
        'guides',      COALESCE(preferences->'guides',      to_jsonb(TRUE)),
        'productNews', COALESCE(preferences->'productNews', to_jsonb(TRUE))
    )
WHERE NOT (
    preferences ? 'offers'
    AND preferences ? 'events'
    AND preferences ? 'guides'
    AND preferences ? 'productNews'
);
