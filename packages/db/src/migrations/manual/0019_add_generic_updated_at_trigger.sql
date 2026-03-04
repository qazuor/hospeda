-- ====================================================================
-- Migration: 20250513_add_generic_updated_at_trigger.sql
-- Purpose: Automatically update the "updated_at" column on any table
--          in public schema that defines updated_at, without per-table SQL
-- ====================================================================

-- 1) Create a generic trigger function that sets updated_at = NOW()
CREATE OR REPLACE FUNCTION set_updated_at()
  RETURNS TRIGGER AS $$
BEGIN
  -- Only act on UPDATE operations
  IF TG_OP = 'UPDATE' THEN
    BEGIN
      -- Try to assign current timestamp; if column missing, ignore
      NEW.updated_at := NOW();
    EXCEPTION WHEN undefined_column THEN
      -- Table has no updated_at column, skip silently
      NULL;
    END;
  END IF;

  -- Return the possibly-modified row
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2) Dynamically attach this trigger to all tables in public schema
--    that have an "updated_at" column
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
    EXECUTE format($fmt$
      CREATE TRIGGER trg_set_updated_at_%1$I
        BEFORE UPDATE ON public.%1$I
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
    $fmt$, tbl.table_name);
  END LOOP;
END;
$$;
