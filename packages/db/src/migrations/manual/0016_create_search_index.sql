-- migrations/triggers/20250513_create_search_index.sql

-- 1. vista materializada con union de todas las entidades
CREATE MATERIALIZED VIEW IF NOT EXISTS search_index AS
SELECT
  'ACCOMMODATION'::text AS entity_type,
  id::text       AS entity_id,
  name,
  description,
  to_tsvector('spanish', coalesce(name, '') || ' ' || coalesce(description, '')) AS tsv
FROM accommodations
WHERE deleted_at IS NULL

UNION ALL

SELECT
  'DESTINATION'::text AS entity_type,
  id::text       AS entity_id,
  name,
  summary        AS description,
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
