-- =============================================================================
-- 0004_refresh_search_index_function.sql
-- Purpose: Create the refresh_search_index() PL/pgSQL function that performs
--          a concurrent refresh of the search_index materialized view.
--          Called by the API cron job scheduler (nightly).
-- Depends on: 0001_search_index_materialized_view.sql (MV must exist)
-- Runtime dependency: 0003_search_index_entity_unique_index.sql (UNIQUE index
--   must exist before calling REFRESH ... CONCURRENTLY at runtime)
-- Related commit: f9e0d338 (deleted), recovered from f9e0d338~1
-- Date: 2026-04-18
-- =============================================================================

-- Refresh function: performs a non-blocking concurrent refresh.
-- CONCURRENTLY requires the UNIQUE index from 0003 to be present at call time.
CREATE OR REPLACE FUNCTION refresh_search_index()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY search_index;
END;
$$;

-- Optional pg_cron schedule (commented out intentionally).
-- Scheduling is handled by the API cron job infrastructure, not pg_cron.
-- SELECT cron.schedule('refresh_search_index', '0 2 * * *', 'SELECT refresh_search_index();');
