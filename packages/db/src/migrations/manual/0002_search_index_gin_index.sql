-- =============================================================================
-- 0002_search_index_gin_index.sql
-- Purpose: Create the GIN index on search_index.tsv to enable fast full-text
--          search queries using the @@ to_tsquery() operator.
-- Depends on: 0001_search_index_materialized_view.sql (MV must exist first)
-- Related commit: f9e0d338 (deleted), recovered from f9e0d338~1
-- Date: 2026-04-18
-- =============================================================================

-- GIN index on the tsvector column.
-- Required for performant full-text search against the materialized view.
-- Note: this GIN index alone is NOT sufficient for REFRESH MATERIALIZED VIEW
-- CONCURRENTLY. A separate UNIQUE index on (entity_type, entity_id) is required
-- for concurrent refresh (see 0003_search_index_entity_unique_index.sql).
CREATE INDEX IF NOT EXISTS idx_search_index_tsv
  ON search_index
  USING GIN(tsv);
