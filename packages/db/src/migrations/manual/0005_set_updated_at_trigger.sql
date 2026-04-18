-- =============================================================================
-- 0005_set_updated_at_trigger.sql
-- Purpose: Create the set_updated_at() trigger function and dynamically attach
--          a BEFORE UPDATE trigger to every table in the public schema that has
--          an updated_at column. Ensures updated_at is always set to NOW() on
--          every UPDATE without requiring application code to pass a timestamp.
-- Depends on: All Drizzle-managed tables with updated_at column must exist
--             (run after drizzle-kit push completes).
-- Related commit: f9e0d338 (deleted), recovered and updated from inline SQL in
--             apply-postgres-extras.sh (current idempotent form)
-- Date: 2026-04-18
-- =============================================================================

-- Part A: Trigger function.
-- Uses CREATE OR REPLACE so re-running this file updates the function safely.
-- EXCEPTION handler silently skips tables that lack updated_at at the DB level.
CREATE OR REPLACE FUNCTION set_updated_at()
  RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    BEGIN
      NEW.updated_at := NOW();
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Part B: Dynamic trigger attachment.
-- Iterates information_schema.columns to find all tables with updated_at and
-- creates the trigger only if it does not already exist (idempotent).
-- NOTE: Tables added after this script runs will not get the trigger
-- automatically. Re-run apply-postgres-extras.sh after adding new tables.
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'updated_at'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.triggers
      WHERE trigger_schema = 'public'
        AND event_object_table = tbl.table_name
        AND trigger_name = 'trg_set_updated_at_' || tbl.table_name
    ) THEN
      EXECUTE format($fmt$
        CREATE TRIGGER trg_set_updated_at_%1$I
          BEFORE UPDATE ON public.%1$I
          FOR EACH ROW
          EXECUTE FUNCTION set_updated_at();
      $fmt$, tbl.table_name);
    END IF;
  END LOOP;
END;
$$;
