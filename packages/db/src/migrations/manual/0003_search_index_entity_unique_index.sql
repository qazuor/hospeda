-- =============================================================================
-- 0003_search_index_entity_unique_index.sql
-- Purpose: Create a UNIQUE index on search_index(entity_type, entity_id).
--          This index is required for REFRESH MATERIALIZED VIEW CONCURRENTLY
--          to succeed at runtime. Without it PostgreSQL raises:
--            ERROR: cannot refresh materialized view "search_index" concurrently
-- Related gap: GAP-078-187
-- Depends on: 0001_search_index_materialized_view.sql (MV must exist first)
-- Must precede: 0004_refresh_search_index_function.sql (function calls CONCURRENTLY)
-- Date: 2026-04-18
-- =============================================================================

-- Non-concurrent form is safe here because the MV is empty on a fresh database
-- (db:fresh-dev / db:fresh-dev workflow). On a live, heavily-read production MV
-- a DBA should run this manually with CREATE UNIQUE INDEX CONCURRENTLY to avoid
-- locking readers. CONCURRENTLY cannot run inside a transaction block, so it
-- cannot be used from apply-postgres-extras.sh directly.
CREATE UNIQUE INDEX IF NOT EXISTS idx_search_index_entity_unique
  ON search_index (entity_type, entity_id);
