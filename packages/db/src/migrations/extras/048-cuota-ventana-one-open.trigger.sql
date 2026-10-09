-- HOS-1442: windows for the same user, vertical and key cannot overlap.
-- Carril 2: Drizzle cannot declare triggers. Safe to apply repeatedly.
CREATE OR REPLACE FUNCTION check_cuota_ventana_one_open()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(
    NEW.user_id::text || ':' || NEW.vertical || ':' || NEW.key, 0
  ));
  IF EXISTS (
    SELECT 1 FROM cuota_ventana other
    WHERE other.user_id = NEW.user_id
      AND other.vertical = NEW.vertical
      AND other.key = NEW.key
      AND other.id <> NEW.id
      -- The structural UNIQUE constraint reports duplicate openings as 23505.
      AND other.opens_at <> NEW.opens_at
      AND other.opens_at < NEW.closes_at
      AND NEW.opens_at < other.closes_at
  ) THEN
    RAISE EXCEPTION 'overlapping cuota_ventana for user, vertical and key'
      USING ERRCODE = '23P01', CONSTRAINT = 'ck_cuota_ventana_one_open';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cuota_ventana_one_open ON cuota_ventana;
CREATE TRIGGER trg_cuota_ventana_one_open
  BEFORE INSERT OR UPDATE OF opens_at, closes_at ON cuota_ventana
  FOR EACH ROW EXECUTE FUNCTION check_cuota_ventana_one_open();
