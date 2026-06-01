-- =============================================================================
-- 0029_amenity_feature_name_description_i18n_down.sql
-- Purpose: Roll back the text→jsonb migration for amenities and features.
--          Converts JSONB i18n objects back to plain text using the `es` locale
--          as the canonical value.
--
-- WARNING: This down migration is LOSSY — only the `es` locale value is
--          preserved. The `en` and `pt` locale values are permanently discarded.
--          Do not apply this migration in production unless you have a data
--          backup and understand the implications.
--
-- Date: 2026-05-30
-- =============================================================================

DO $$
BEGIN

    -- -------------------------------------------------------------------------
    -- AMENITIES TABLE
    -- -------------------------------------------------------------------------

    -- name: jsonb NOT NULL  →  text NOT NULL
    IF (
        SELECT data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'amenities'
          AND column_name  = 'name'
    ) = 'jsonb' THEN
        ALTER TABLE amenities
            ALTER COLUMN name TYPE text
            USING (name->>'es');
    END IF;

    -- description: jsonb (nullable)  →  text (nullable)
    IF (
        SELECT data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'amenities'
          AND column_name  = 'description'
    ) = 'jsonb' THEN
        ALTER TABLE amenities
            ALTER COLUMN description TYPE text
            USING (description->>'es');
    END IF;

    -- -------------------------------------------------------------------------
    -- FEATURES TABLE
    -- -------------------------------------------------------------------------

    -- name: jsonb NOT NULL  →  text NOT NULL
    IF (
        SELECT data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'features'
          AND column_name  = 'name'
    ) = 'jsonb' THEN
        ALTER TABLE features
            ALTER COLUMN name TYPE text
            USING (name->>'es');
    END IF;

    -- description: jsonb (nullable)  →  text (nullable)
    IF (
        SELECT data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'features'
          AND column_name  = 'description'
    ) = 'jsonb' THEN
        ALTER TABLE features
            ALTER COLUMN description TYPE text
            USING (description->>'es');
    END IF;

END;
$$;
