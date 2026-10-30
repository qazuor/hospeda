-- Coord-25: a LAPIDA subscription requires a provider_link at COMMIT.
-- Carril 2: PostgreSQL deferred constraint triggers, absent from Drizzle.
-- Idempotent: replace the function and recreate both triggers on each apply.

CREATE OR REPLACE FUNCTION check_subscription_tombstone_provider_link()
RETURNS trigger AS $$
DECLARE
  checked_subscription_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'provider_link' THEN
    checked_subscription_id := OLD.subscription_id;
  ELSE
    checked_subscription_id := NEW.id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM subscription s
    WHERE s.id = checked_subscription_id
      AND s.class = 'LAPIDA'
      AND NOT EXISTS (
        SELECT 1 FROM provider_link pl WHERE pl.subscription_id = s.id
      )
  ) THEN
    RAISE EXCEPTION 'Coord-25: LAPIDA subscription % requires provider_link', checked_subscription_id
      USING ERRCODE = '23514', CONSTRAINT = 'ck_subscription_tombstone_provider_link';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subscription_tombstone_provider_link ON subscription;
CREATE CONSTRAINT TRIGGER trg_subscription_tombstone_provider_link
AFTER INSERT OR UPDATE ON subscription
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_subscription_tombstone_provider_link();

DROP TRIGGER IF EXISTS trg_provider_link_tombstone_guard ON provider_link;
CREATE CONSTRAINT TRIGGER trg_provider_link_tombstone_guard
AFTER DELETE OR UPDATE OF subscription_id ON provider_link
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_subscription_tombstone_provider_link();
