-- HOS-2192: location_exception_event is the append-only audit trail of the location
-- exceptions; reapply safely after the baseline. A row is never updated or deleted
-- (TRUNCATE is not row-level and stays available to test setup).
CREATE OR REPLACE FUNCTION "location_exception_event_reject_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION 'location_exception_event is append-only: % is not allowed', TG_OP
		USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS "location_exception_event_append_only" ON "location_exception_event";
CREATE TRIGGER "location_exception_event_append_only"
	BEFORE UPDATE OR DELETE ON "location_exception_event"
	FOR EACH ROW EXECUTE FUNCTION "location_exception_event_reject_mutation"();
