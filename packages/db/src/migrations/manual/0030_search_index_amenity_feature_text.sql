-- =============================================================================
-- 0030_search_index_amenity_feature_text.sql
-- Purpose: Rebuild the search_index materialized view so that an
--          accommodation's associated amenity and feature names are
--          included in its full-text search vector.
--
-- Context: SPEC-172 PR4.
--   PR2 migrated amenities.name / features.name from plain text to
--   JSONB i18n objects { "es", "en", "pt" } (see migration 0029).
--   The original ACCOMMODATION SELECT in 0001 only indexed the
--   accommodation's own name + description; amenity/feature text was
--   never part of the vector.
--
-- Strategy:
--   The view is rebuilt with a LEFT JOIN on the junction tables
--   (r_accommodation_amenity, r_accommodation_feature) and catalog tables
--   (amenities, features).  Amenity / feature names are aggregated via
--   string_agg(DISTINCT ...) to collapse the one-to-many fan-out back to
--   one row per accommodation.  The Spanish locale key (->>  'es') is used
--   exclusively because the view's tsvector config is 'spanish' and all
--   seed data stores the canonical text in the 'es' key (en/pt are copies
--   of es for now).
--   NOTE: es-only locale extraction is intentional.  When en/pt locale data
--   diverges from es in a future sprint the tsvector config should be
--   revisited (separate language-specific vectors or a universal config).
--
-- REFRESH CONCURRENTLY compatibility:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY requires a UNIQUE index on the
--   view.  The original 0003 index (idx_search_index_entity_unique) is
--   dropped along with the view and recreated here, as are the GIN index
--   (idx_search_index_tsv, from 0002) used for full-text query performance.
--   The refresh function (0004) calls CONCURRENTLY and does NOT need to
--   change — it references only the view name.
--
-- Idempotency:
--   DROP / CREATE are not fully idempotent (DROP fails if the view does not
--   exist).  The apply-postgres-extras script always runs on a fresh DB
--   (db:fresh-dev) where 0001 precedes this file, so the view is always
--   present when this migration runs.  On a live DB a DBA should verify the
--   view exists before running.
--
-- Depends on:
--   0001_search_index_materialized_view.sql   (creates original view)
--   0003_search_index_entity_unique_index.sql  (creates UNIQUE index)
--   0029_amenity_feature_name_description_i18n.sql (JSONB name/description)
-- Supersedes:
--   0001 ACCOMMODATION SELECT (this file replaces that definition)
-- Date: 2026-05-30
-- =============================================================================

-- Step 1: Drop the existing materialized view and all dependent indexes.
-- Indexes on a materialized view are dropped automatically by DROP MATERIALIZED VIEW.
DROP MATERIALIZED VIEW IF EXISTS search_index;

-- Step 2: Recreate the materialized view with amenity + feature text included
-- in the ACCOMMODATION tsvector.
--
-- ACCOMMODATION SELECT changes vs. 0001:
--   * LEFT JOIN r_accommodation_amenity raa  ON raa.accommodation_id = a.id
--                                           AND raa (no deleted_at on junction)
--   * LEFT JOIN amenities am                 ON am.id = raa.amenity_id
--                                           AND am.deleted_at IS NULL
--   * LEFT JOIN r_accommodation_feature raf  ON raf.accommodation_id = a.id
--   * LEFT JOIN features ft                  ON ft.id = raf.feature_id
--                                           AND ft.deleted_at IS NULL
--   * string_agg(DISTINCT am.name->>'es', ' ')  aggregated amenity names (es locale)
--   * string_agg(DISTINCT ft.name->>'es', ' ')  aggregated feature names (es locale)
--   * GROUP BY a.id, a.name, a.description    to collapse the fan-out
--   * tsvector now includes amenity/feature text appended to name + description
--
-- DESTINATION, EVENT, POST SELECTs are unchanged from 0001.
CREATE MATERIALIZED VIEW search_index AS

SELECT
  'ACCOMMODATION'::text                 AS entity_type,
  a.id::text                            AS entity_id,
  a.name,
  a.description,
  to_tsvector(
    'spanish',
    coalesce(a.name, '')
    || ' ' || coalesce(a.description, '')
    -- Amenity names (es locale only; en/pt are copies of es at time of writing)
    || ' ' || coalesce(string_agg(DISTINCT am.name->>'es', ' '), '')
    -- Feature names (es locale only)
    || ' ' || coalesce(string_agg(DISTINCT ft.name->>'es', ' '), '')
  ) AS tsv
FROM accommodations a
LEFT JOIN r_accommodation_amenity raa
       ON raa.accommodation_id = a.id
LEFT JOIN amenities am
       ON am.id = raa.amenity_id
      AND am.deleted_at IS NULL
LEFT JOIN r_accommodation_feature raf
       ON raf.accommodation_id = a.id
LEFT JOIN features ft
       ON ft.id = raf.feature_id
     AND ft.deleted_at IS NULL
WHERE a.deleted_at IS NULL
GROUP BY a.id, a.name, a.description

UNION ALL

SELECT
  'DESTINATION'::text AS entity_type,
  id::text            AS entity_id,
  name,
  summary             AS description,
  to_tsvector('spanish', coalesce(name, '') || ' ' || coalesce(summary, '')) AS tsv
FROM destinations
WHERE deleted_at IS NULL

UNION ALL

SELECT
  'EVENT'::text AS entity_type,
  id::text      AS entity_id,
  name,
  summary       AS description,
  to_tsvector('spanish', coalesce(name, '') || ' ' || coalesce(summary, '')) AS tsv
FROM events
WHERE deleted_at IS NULL

UNION ALL

SELECT
  'POST'::text AS entity_type,
  id::text     AS entity_id,
  title        AS name,
  summary      AS description,
  to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(summary, '')) AS tsv
FROM posts
WHERE deleted_at IS NULL
;

-- Step 3: Recreate the GIN index on tsv (from 0002).
-- Required for performant full-text search (@@  to_tsquery() operator).
CREATE INDEX IF NOT EXISTS idx_search_index_tsv
  ON search_index
  USING GIN(tsv);

-- Step 4: Recreate the UNIQUE index on (entity_type, entity_id) (from 0003).
-- REQUIRED for REFRESH MATERIALIZED VIEW CONCURRENTLY to work at runtime.
-- Without this index PostgreSQL raises:
--   ERROR: cannot refresh materialized view "search_index" concurrently
CREATE UNIQUE INDEX IF NOT EXISTS idx_search_index_entity_unique
  ON search_index (entity_type, entity_id);
