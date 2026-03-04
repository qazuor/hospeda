-- migrations/triggers/20250513_refresh_search_index_function.sql

-- 1) Función para refrescar la vista
CREATE OR REPLACE FUNCTION refresh_search_index()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY search_index;
END;
$$;

-- 2) (Opcional) Programar con pg_cron para que corra cada noche a las 2AM
-- Requires the pg_cron extension
-- SELECT cron.schedule('refresh_search_index', '0 2 * * *', 'SELECT refresh_search_index();');
