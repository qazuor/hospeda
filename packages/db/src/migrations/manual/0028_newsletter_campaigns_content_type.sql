-- =============================================================================
-- 0028_newsletter_campaigns_content_type.sql
-- Purpose: Add optional `content_type` segmentation column to
--          `newsletter_campaigns`, backed by `NewsletterContentTypeEnum`.
--          When NULL the campaign is sent to every active subscriber matching
--          the locale filter (legacy behavior). When set to one of
--          `offers | events | guides | productNews` only subscribers with
--          `preferences[contentType] = true` are eligible.
-- KEEP IN SYNC with:
--   * `packages/schemas/src/enums/newsletter-content-type.enum.ts`
--     (NewsletterContentTypeEnum values)
--   * `packages/schemas/src/entities/newsletter/newsletter-campaign.schema.ts`
--     (NewsletterCampaignSchema.contentType)
--   * `packages/db/src/schemas/newsletter/newsletter_campaigns.dbschema.ts`
--     (newsletterCampaigns.contentType column)
-- Idempotent: enum creation + column addition are guarded by existence checks.
-- Date: 2026-05-20
-- =============================================================================

DO $$
BEGIN
    -- 1. Create the Pg enum type if it does not exist yet.
    --    NOTE: drizzle-kit emits enum creation as part of its generated
    --    migrations, but this manual file lives outside that flow so it must
    --    self-create. The values mirror NewsletterContentTypeEnum exactly.
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'newsletter_content_type_enum'
    ) THEN
        CREATE TYPE newsletter_content_type_enum AS ENUM (
            'offers',
            'events',
            'guides',
            'productNews'
        );
    END IF;

    -- 2. Add the column to newsletter_campaigns if it does not exist.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'newsletter_campaigns'
    ) THEN
        RAISE NOTICE 'Table newsletter_campaigns does not exist, skipping content_type migration.';
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'newsletter_campaigns'
          AND column_name = 'content_type'
    ) THEN
        ALTER TABLE newsletter_campaigns
            ADD COLUMN content_type newsletter_content_type_enum;
    END IF;
END;
$$;
