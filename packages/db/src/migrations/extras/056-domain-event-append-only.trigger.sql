-- HOS-1424, AC:U2:11: domain_event is append-only; reapply safely after the baseline.
CREATE OR REPLACE FUNCTION "domain_event_reject_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION 'domain_event is append-only: % is not allowed', TG_OP
		USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS "domain_event_append_only" ON "domain_event";
CREATE TRIGGER "domain_event_append_only"
	BEFORE UPDATE OR DELETE ON "domain_event"
	FOR EACH ROW EXECUTE FUNCTION "domain_event_reject_mutation"();
