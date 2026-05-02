-- =============================================================================
-- 0021_create_gh_refresh_user.sql
-- Purpose: Create a least-privilege PostgreSQL role used by the GitHub Actions
--          "Refresh Search Index" cron job. The role can ONLY execute the
--          refresh_search_index() function (defined in 0004). It cannot read,
--          write, or alter any other table.
--
-- Security model:
--   1. refresh_search_index() is SECURITY DEFINER (see 0004), so the actual
--      REFRESH MATERIALIZED VIEW runs with owner privileges, not gh_refresh.
--   2. gh_refresh has NO grants on any table or schema beyond CONNECT and
--      EXECUTE on the function. Credential leakage limits damage to "trigger
--      one extra view refresh".
--
-- Password handling:
--   This script creates the role with a placeholder password the first time
--   it runs. The placeholder MUST be rotated immediately after creation:
--
--     ALTER USER gh_refresh WITH PASSWORD '<long-random-secret>';
--
--   Subsequent runs of this script DO NOT change the password (idempotent).
-- Date: 2026-05-02
-- =============================================================================

-- Create the role only if it does not already exist.
-- NOTE: PostgreSQL does not support CREATE USER IF NOT EXISTS; use a DO block.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'gh_refresh') THEN
        EXECUTE 'CREATE USER gh_refresh WITH PASSWORD ''CHANGE_ME_AFTER_CREATION_VIA_ALTER_USER''';
        RAISE NOTICE 'Created role gh_refresh with placeholder password. ROTATE IMMEDIATELY via: ALTER USER gh_refresh WITH PASSWORD ''<secret>'';';
    END IF;
END
$$;

-- Idempotent grants (re-applied every run; PostgreSQL deduplicates them).
-- gh_refresh needs CONNECT to the current database. PostgreSQL grammar does
-- not accept current_database() as the target name, so resolve dynamically.
DO $$
DECLARE
    db_name text := current_database();
BEGIN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO gh_refresh', db_name);
END
$$;

GRANT USAGE ON SCHEMA public TO gh_refresh;

-- The only thing gh_refresh is allowed to do: invoke refresh_search_index().
-- The function is SECURITY DEFINER (0004), so the actual refresh runs with the
-- owner's privileges. gh_refresh never touches any table directly.
GRANT EXECUTE ON FUNCTION refresh_search_index() TO gh_refresh;

-- Explicit revocation of any default PUBLIC grants on sensitive surfaces.
-- (Defense in depth — Neon/Vercel Postgres typically already restricts these.)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM gh_refresh;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM gh_refresh;
