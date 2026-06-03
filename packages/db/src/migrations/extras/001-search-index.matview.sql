-- =============================================================================
-- 001-search-index.matview.sql
-- Consolidates:
--   0001_search_index_materialized_view.sql  (original matview, superseded)
--   0002_search_index_gin_index.sql          (GIN index on tsv)
--   0003_search_index_entity_unique_index.sql (UNIQUE index for CONCURRENTLY)
--   0004_refresh_search_index_function.sql   (refresh_search_index function)
--   0030_search_index_amenity_feature_text.sql (FINAL matview with amenity/feature text)
--
-- The matview definition from 0030 is used as the canonical final version,
-- superseding the original 0001 ACCOMMODATION SELECT.
--
-- Idempotency strategy:
--   DROP MATERIALIZED VIEW IF EXISTS ... CASCADE (drops dependent indexes too)
--   CREATE MATERIALIZED VIEW (no IF NOT EXISTS — DROP ensures it's gone)
--   CREATE INDEX IF NOT EXISTS (in case file is applied without DROP)
--   CREATE OR REPLACE FUNCTION (always safe)
-- =============================================================================

-- Step 1: Drop the existing materialized view and all dependent indexes.
-- Indexes on a materialized view are dropped automatically by DROP ... CASCADE.
DROP MATERIALIZED VIEW IF EXISTS search_index CASCADE;

-- Step 2: Create the materialized view with amenity + feature text included
-- in the ACCOMMODATION tsvector (final definition from 0030).
--
-- ACCOMMODATION row: LEFT JOINs r_accommodation_amenity + amenities and
-- r_accommodation_feature + features to aggregate amenity/feature names (es
-- locale only; en/pt are copies of es at time of writing). GROUP BY collapses
-- the one-to-many fan-out back to one row per accommodation.
--
-- DESTINATION, EVENT, POST rows: unchanged from original 0001 definition.
--
-- tsvector config: 'spanish'. All source tables are filtered by deleted_at IS
-- NULL so soft-deleted records are excluded from search results automatically.
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

-- Step 3: GIN index on the tsvector column (from 0002).
-- Required for performant full-text search (@@  to_tsquery() operator).
CREATE INDEX IF NOT EXISTS idx_search_index_tsv
  ON search_index
  USING GIN(tsv);

-- Step 4: UNIQUE index on (entity_type, entity_id) (from 0003).
-- REQUIRED for REFRESH MATERIALIZED VIEW CONCURRENTLY to work at runtime.
-- Without this index PostgreSQL raises:
--   ERROR: cannot refresh materialized view "search_index" concurrently
CREATE UNIQUE INDEX IF NOT EXISTS idx_search_index_entity_unique
  ON search_index (entity_type, entity_id);

-- Step 5: Refresh function (from 0004).
-- CREATE OR REPLACE is idempotent — safe to re-run any number of times.
-- SECURITY DEFINER allows the API cron job (and any future role) to trigger
-- a refresh without ownership of the materialized view.
-- CONCURRENTLY requires the UNIQUE index above to be present at call time.
CREATE OR REPLACE FUNCTION refresh_search_index()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY search_index;
END;
$$;

-- Optional pg_cron schedule (commented out intentionally).
-- Scheduling is handled by the API cron job infrastructure, not pg_cron.
-- SELECT cron.schedule('refresh_search_index', '0 2 * * *', 'SELECT refresh_search_index();');
