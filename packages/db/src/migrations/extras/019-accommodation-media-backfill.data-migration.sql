-- =============================================================================
-- 019-accommodation-media-backfill.data-migration.sql
--
-- Purpose:
--   Backfill the `accommodation_media` relational table from the legacy
--   `accommodations.media` JSONB column (SPEC-204, T-006).
--
--   For each accommodation that has media photos in the JSONB blob and has NO
--   existing rows in `accommodation_media` yet, this migration inserts one row
--   per photo, mapping:
--
--     media->'featuredImage'  → is_featured=true, state='visible', sort_order=0
--     media->'gallery'[n]     → is_featured=false, state='visible',
--                                sort_order = (featuredImage present ? n : n-1)
--                                (gallery ordinal is 1-based via WITH ORDINALITY)
--     media->'archivedGallery'[n] → is_featured=false, state='archived',
--                                    archived_at=NOW(), sort_order = n-1
--
--   Column mapping from JSON key → DB column:
--     url             → url            (required)
--     caption         → caption        (nullable)
--     description     → description    (nullable)
--     alt             → alt            (nullable)
--     publicId        → public_id      (nullable)
--     attribution     → attribution    (nullable JSONB)
--     moderationState → moderation_state (cast to moderation_status_enum,
--                        defaults to 'PENDING' when absent/null)
--
--   Videos (media->'videos') are NOT migrated — they remain in the JSONB column
--   (SPEC-204 D1 decision: videos stay in JSONB).
--
-- Idempotency:
--   Guarded by two layers:
--   1. Table-existence check — skips silently if `accommodation_media` does not
--      exist yet (structural migration has not run).
--   2. Per-accommodation NOT EXISTS guard — only inserts for accommodations that
--      currently have ZERO rows in accommodation_media. Re-running after a
--      partial or full backfill inserts nothing.
--
-- Ordering guarantee:
--   sort_order for visible rows:
--     - featuredImage always gets sort_order 0.
--     - gallery[0] gets sort_order 1 when featuredImage exists, or 0 when absent.
--     - gallery is enumerated WITH ORDINALITY; ordinal is 1-based, so:
--         featured present: sort_order = ordinality         (1, 2, 3, ...)
--         featured absent:  sort_order = ordinality - 1    (0, 1, 2, ...)
--
-- Runs via:
--   pnpm db:apply-extras   (local dev, staging deploy, prod deploy)
--
-- NEVER run drizzle-kit push against staging/prod — see packages/db/CLAUDE.md.
-- =============================================================================

DO $$
DECLARE
    inserted_count integer := 0;
    accom_count    integer := 0;
BEGIN
    -- -------------------------------------------------------------------------
    -- Guard: skip silently if the relational table doesn't exist yet.
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name   = 'accommodation_media'
    ) THEN
        RAISE NOTICE '019-accommodation-media-backfill: table accommodation_media does not exist, skipping.';
        RETURN;
    END IF;

    -- -------------------------------------------------------------------------
    -- Backfill: one INSERT per accommodation that has photos but no rows yet.
    --
    -- The CTE `candidates` selects accommodations that:
    --   a) have a non-null media JSONB column
    --   b) have at least one of featuredImage / gallery / archivedGallery
    --   c) have NO existing rows in accommodation_media (idempotency guard)
    --
    -- Per candidate we build three UNION ALL branches:
    --   1. featuredImage branch — at most one row per accommodation
    --   2. gallery branch       — one row per gallery photo
    --   3. archivedGallery      — one row per archived photo
    --
    -- All three branches are filtered with NULLIF / IS NOT NULL so missing or
    -- empty arrays simply contribute no rows.
    --
    -- The accommodation-level flag `has_featured` (true when featuredImage is a
    -- non-null JSON object) drives the sort_order offset for gallery photos.
    -- -------------------------------------------------------------------------
    WITH candidates AS (
        SELECT
            a.id                                       AS accommodation_id,
            a.media                                    AS media,
            (
                a.media ? 'featuredImage'
                AND a.media -> 'featuredImage' IS NOT NULL
                AND jsonb_typeof(a.media -> 'featuredImage') = 'object'
            )                                          AS has_featured
        FROM accommodations a
        WHERE
            a.media IS NOT NULL
            AND (
                (a.media ? 'featuredImage' AND jsonb_typeof(a.media -> 'featuredImage') = 'object')
                OR (a.media ? 'gallery'         AND jsonb_typeof(a.media -> 'gallery')         = 'array' AND jsonb_array_length(a.media -> 'gallery') > 0)
                OR (a.media ? 'archivedGallery' AND jsonb_typeof(a.media -> 'archivedGallery') = 'array' AND jsonb_array_length(a.media -> 'archivedGallery') > 0)
            )
            AND NOT EXISTS (
                SELECT 1 FROM accommodation_media am
                WHERE am.accommodation_id = a.id
            )
    ),
    photo_rows AS (
        -- -------------------------------------------------------------------
        -- Branch 1: featuredImage  (sort_order always 0)
        -- -------------------------------------------------------------------
        SELECT
            gen_random_uuid()                                            AS id,
            c.accommodation_id,
            (c.media -> 'featuredImage' ->> 'url')                      AS url,
            (c.media -> 'featuredImage' ->> 'caption')                  AS caption,
            (c.media -> 'featuredImage' ->> 'description')              AS description,
            (c.media -> 'featuredImage' ->> 'alt')                      AS alt,
            (c.media -> 'featuredImage' ->> 'publicId')                 AS public_id,
            CASE
                WHEN c.media -> 'featuredImage' ? 'attribution'
                     AND jsonb_typeof(c.media -> 'featuredImage' -> 'attribution') = 'object'
                THEN c.media -> 'featuredImage' -> 'attribution'
                ELSE NULL
            END                                                          AS attribution,
            COALESCE(
                NULLIF(c.media -> 'featuredImage' ->> 'moderationState', ''),
                'PENDING'
            )::moderation_status_enum                                    AS moderation_state,
            'visible'::accommodation_media_state_enum                    AS state,
            TRUE                                                         AS is_featured,
            0                                                            AS sort_order,
            NULL::timestamptz                                            AS archived_at
        FROM candidates c
        WHERE c.has_featured

        UNION ALL

        -- -------------------------------------------------------------------
        -- Branch 2: gallery photos
        -- sort_order = (has_featured ? ordinal : ordinal - 1)
        -- ordinal is 1-based, so:
        --   has_featured  → 1, 2, 3, ...  (featured holds 0)
        --   !has_featured → 0, 1, 2, ...
        -- -------------------------------------------------------------------
        SELECT
            gen_random_uuid()                                            AS id,
            c.accommodation_id,
            (photo ->> 'url')                                           AS url,
            (photo ->> 'caption')                                       AS caption,
            (photo ->> 'description')                                   AS description,
            (photo ->> 'alt')                                           AS alt,
            (photo ->> 'publicId')                                      AS public_id,
            CASE
                WHEN photo ? 'attribution'
                     AND jsonb_typeof(photo -> 'attribution') = 'object'
                THEN photo -> 'attribution'
                ELSE NULL
            END                                                          AS attribution,
            COALESCE(
                NULLIF(photo ->> 'moderationState', ''),
                'PENDING'
            )::moderation_status_enum                                    AS moderation_state,
            'visible'::accommodation_media_state_enum                    AS state,
            FALSE                                                        AS is_featured,
            CASE WHEN c.has_featured
                 THEN ord::integer
                 ELSE (ord - 1)::integer
            END                                                          AS sort_order,
            NULL::timestamptz                                            AS archived_at
        FROM candidates c,
             LATERAL jsonb_array_elements(
                 CASE
                     WHEN c.media ? 'gallery'
                          AND jsonb_typeof(c.media -> 'gallery') = 'array'
                     THEN c.media -> 'gallery'
                     ELSE '[]'::jsonb
                 END
             ) WITH ORDINALITY AS t(photo, ord)

        UNION ALL

        -- -------------------------------------------------------------------
        -- Branch 3: archivedGallery photos (SPEC-167)
        -- sort_order = ordinal - 1  (0-based, independent of visible ordering)
        -- archived_at = NOW() (back-fill timestamp for FIFO restore ordering)
        -- -------------------------------------------------------------------
        SELECT
            gen_random_uuid()                                            AS id,
            c.accommodation_id,
            (photo ->> 'url')                                           AS url,
            (photo ->> 'caption')                                       AS caption,
            (photo ->> 'description')                                   AS description,
            (photo ->> 'alt')                                           AS alt,
            (photo ->> 'publicId')                                      AS public_id,
            CASE
                WHEN photo ? 'attribution'
                     AND jsonb_typeof(photo -> 'attribution') = 'object'
                THEN photo -> 'attribution'
                ELSE NULL
            END                                                          AS attribution,
            COALESCE(
                NULLIF(photo ->> 'moderationState', ''),
                'PENDING'
            )::moderation_status_enum                                    AS moderation_state,
            'archived'::accommodation_media_state_enum                   AS state,
            FALSE                                                        AS is_featured,
            (ord - 1)::integer                                           AS sort_order,
            NOW()                                                        AS archived_at
        FROM candidates c,
             LATERAL jsonb_array_elements(
                 CASE
                     WHEN c.media ? 'archivedGallery'
                          AND jsonb_typeof(c.media -> 'archivedGallery') = 'array'
                     THEN c.media -> 'archivedGallery'
                     ELSE '[]'::jsonb
                 END
             ) WITH ORDINALITY AS t(photo, ord)
    )
    INSERT INTO accommodation_media (
        id,
        accommodation_id,
        url,
        caption,
        description,
        alt,
        public_id,
        attribution,
        moderation_state,
        state,
        is_featured,
        sort_order,
        archived_at,
        created_at,
        updated_at
    )
    SELECT
        pr.id,
        pr.accommodation_id,
        pr.url,
        pr.caption,
        pr.description,
        pr.alt,
        pr.public_id,
        pr.attribution,
        pr.moderation_state,
        pr.state,
        pr.is_featured,
        pr.sort_order,
        pr.archived_at,
        NOW() AS created_at,
        NOW() AS updated_at
    FROM photo_rows pr
    WHERE pr.url IS NOT NULL AND pr.url <> '';

    GET DIAGNOSTICS inserted_count = ROW_COUNT;

    SELECT COUNT(DISTINCT accommodation_id)
    INTO accom_count
    FROM accommodation_media;

    RAISE NOTICE '019-accommodation-media-backfill: inserted % photo row(s) for % accommodation(s).',
                 inserted_count, accom_count;
END;
$$;
