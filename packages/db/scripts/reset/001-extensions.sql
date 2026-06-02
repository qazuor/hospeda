-- =============================================================================
-- 001-extensions.sql  (SPEC-178)
--
-- Postgres extensions preflight. MUST run AFTER the schema reset (000) and
-- BEFORE `drizzle-kit migrate`.
--
-- WHY this is mandatory (verified, SPEC-178 OQ2):
--   - The 0000 baseline uses `gen_random_uuid()` (pgcrypto). Without pgcrypto,
--     migrate fails on the very first table.
--   - `DROP SCHEMA public CASCADE` (000) removes these extensions' objects from
--     the public schema.
--   - NO other VPS rebuild flow re-creates them — today they are only installed
--     by the Docker init.sql (first container boot) and the test global-setups.
--     A `hops psql` reset does not go through Docker init, so they must be
--     re-created here.
--
-- Idempotent (IF NOT EXISTS). Run as a superuser.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";
