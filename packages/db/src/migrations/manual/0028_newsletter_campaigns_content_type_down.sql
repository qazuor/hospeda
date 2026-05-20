-- =============================================================================
-- 0028_newsletter_campaigns_content_type_down.sql
-- Inverse of 0028. Drops the `content_type` column from `newsletter_campaigns`
-- and removes the `newsletter_content_type_enum` Pg type. Idempotent.
-- Date: 2026-05-20
-- =============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'newsletter_campaigns'
          AND column_name = 'content_type'
    ) THEN
        ALTER TABLE newsletter_campaigns DROP COLUMN content_type;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'newsletter_content_type_enum'
    ) THEN
        DROP TYPE newsletter_content_type_enum;
    END IF;
END;
$$;
