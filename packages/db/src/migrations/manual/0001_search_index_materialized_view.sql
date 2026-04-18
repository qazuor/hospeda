-- =============================================================================
-- 0001_search_index_materialized_view.sql
-- Purpose: Create the search_index materialized view that aggregates all
--          searchable entities (accommodations, destinations, events, posts)
--          into a single full-text tsvector index.
-- Related gap: GAP-078-187 (required for CONCURRENTLY refresh)
-- Related commit: f9e0d338 (deleted), recovered from f9e0d338~1
-- Date: 2026-04-18
-- =============================================================================

-- Materialized view: union of all searchable entities.
-- Each source table is filtered by deleted_at IS NULL so soft-deleted
-- records are excluded from search results automatically.
CREATE MATERIALIZED VIEW IF NOT EXISTS search_index AS
SELECT
  'ACCOMMODATION'::text AS entity_type,
  id::text              AS entity_id,
  name,
  description,
  to_tsvector('spanish', coalesce(name, '') || ' ' || coalesce(description, '')) AS tsv
FROM accommodations
WHERE deleted_at IS NULL

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
