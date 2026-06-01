-- =============================================================================
-- 0029_amenity_feature_name_description_i18n.sql
-- Purpose: Migrate `name` and `description` columns on the `amenities` and
--          `features` catalog tables from plain `text` to JSONB i18n objects
--          of the shape `{ "es": <text>, "en": <text>, "pt": <text> }`.
--
-- This migration is part of SPEC-172 PR2 (catalog i18n foundation).
--
-- KEEP IN SYNC with:
--   * packages/schemas/src/common/i18n.schema.ts  (I18nText type definition)
--   * packages/db/src/schemas/accommodation/amenity.dbschema.ts
--     (amenities.name / amenities.description column type)
--   * packages/db/src/schemas/accommodation/feature.dbschema.ts
--     (features.name / features.description column type)
--
-- Backfill strategy:
--   Existing plain-text values are preserved by replicating them into all
--   three locale slots.  The USING clause wraps the current text value as:
--     { "es": <value>, "en": <value>, "pt": <value> }
--   This avoids data loss while producing a valid I18nText JSONB value.
--
-- Idempotent: column-type checks guard each ALTER TABLE statement.
-- After apply: run apply-postgres-extras.sh + re-seed to pick up new types.
-- Date: 2026-05-30
-- =============================================================================

DO $$
BEGIN

    -- -------------------------------------------------------------------------
    -- AMENITIES TABLE
    -- -------------------------------------------------------------------------

    -- name: text NOT NULL  →  jsonb NOT NULL
    IF (
        SELECT data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'amenities'
          AND column_name  = 'name'
    ) = 'text' THEN
        ALTER TABLE amenities
            ALTER COLUMN name TYPE jsonb
            USING jsonb_build_object('es', name, 'en', name, 'pt', name);
    END IF;

    -- description: text (nullable)  →  jsonb (nullable)
    IF (
        SELECT data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'amenities'
          AND column_name  = 'description'
    ) = 'text' THEN
        ALTER TABLE amenities
            ALTER COLUMN description TYPE jsonb
            USING CASE
                WHEN description IS NULL THEN NULL
                ELSE jsonb_build_object('es', description, 'en', description, 'pt', description)
            END;
    END IF;

    -- -------------------------------------------------------------------------
    -- FEATURES TABLE
    -- -------------------------------------------------------------------------

    -- name: text NOT NULL  →  jsonb NOT NULL
    IF (
        SELECT data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'features'
          AND column_name  = 'name'
    ) = 'text' THEN
        ALTER TABLE features
            ALTER COLUMN name TYPE jsonb
            USING jsonb_build_object('es', name, 'en', name, 'pt', name);
    END IF;

    -- description: text (nullable)  →  jsonb (nullable)
    IF (
        SELECT data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'features'
          AND column_name  = 'description'
    ) = 'text' THEN
        ALTER TABLE features
            ALTER COLUMN description TYPE jsonb
            USING CASE
                WHEN description IS NULL THEN NULL
                ELSE jsonb_build_object('es', description, 'en', description, 'pt', description)
            END;
    END IF;

END;
$$;
