-- =============================================================================
-- 000-reset-schema.sql  (SPEC-178)
--
-- Wipes the schema CONTENTS for a clean versioned rebuild — WITHOUT dropping
-- the database itself (the DB, its owner role, and connection config stay
-- intact). Run as the DB owner/superuser via `hops psql` BEFORE the extensions
-- preflight (001) and `drizzle-kit migrate`.
--
-- DESTRUCTIVE: drops every table, view, function, type and sequence in the
-- `public` schema. Used by `hops db-migrate --reset`, which requires an
-- explicit typed confirmation on prod.
--
-- gh_refresh: Postgres roles are CLUSTER-WIDE and survive `DROP SCHEMA`, so the
-- obsolete Vercel+Neon-era `gh_refresh` role is dropped explicitly here. The
-- search_index matview is now refreshed by the in-process node-cron job, not by
-- an external role. See SPEC-178 §13 OQ-A.
-- =============================================================================

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- Drop the drizzle migration journal schema so drizzle-kit migrate starts
-- fresh from the baseline migration on the next run.
--
-- Without this, the `drizzle` schema (containing __drizzle_migrations)
-- survives the DROP SCHEMA public CASCADE above. On the next
-- `drizzle-kit migrate` the journal shows all past migrations as already
-- applied, so the migration tool skips the baseline and jumps straight to
-- ALTER TABLE / CREATE INDEX statements — which fail because the tables
-- they reference were just dropped with `public` (error example:
-- 'relation "accommodation_reviews" does not exist'). Dropping `drizzle`
-- here forces the migrator to replay from migration 0000, recreating every
-- object in order. drizzle-kit recreates the schema automatically.
DROP SCHEMA IF EXISTS drizzle CASCADE;

-- Restore default schema privileges (PostgreSQL 15 no longer grants CREATE on
-- public to everyone by default; the migrating role needs it).
GRANT ALL ON SCHEMA public TO CURRENT_USER;
GRANT ALL ON SCHEMA public TO public;

-- Obsolete role (cluster-wide; survives the DROP SCHEMA above).
DROP USER IF EXISTS gh_refresh;
