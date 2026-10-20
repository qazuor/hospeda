CREATE TABLE "domain_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" varchar(255) NOT NULL,
	"actor_id" uuid,
	"actor_type" varchar(20) NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"changes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reason" text,
	"correlation_id" uuid NOT NULL,
	CONSTRAINT "domain_event_event_type_check" CHECK ("domain_event"."event_type" IN ('email.undeliverable')),
	CONSTRAINT "domain_event_actor_type_check" CHECK ("domain_event"."actor_type" IN ('owner', 'admin', 'job', 'provider')),
	CONSTRAINT "domain_event_person_actor_check" CHECK ("domain_event"."actor_type" NOT IN ('owner', 'admin') OR "domain_event"."actor_id" IS NOT NULL),
	CONSTRAINT "domain_event_changes_array_check" CHECK (jsonb_typeof("domain_event"."changes") = 'array')
);
--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "correlation_id" uuid;--> statement-breakpoint
CREATE INDEX "domain_event_entity_idx" ON "domain_event" USING btree ("entity_type","entity_id","occurred_at");--> statement-breakpoint
CREATE INDEX "domain_event_correlation_idx" ON "domain_event" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "domain_event_type_idx" ON "domain_event" USING btree ("event_type","occurred_at");--> statement-breakpoint
-- Hand-appended after `db:generate` (HOS-1424, AC:U2:11): domain_event is
-- APPEND-ONLY. Drizzle cannot express a trigger, and the owner placed it in
-- this structural migration (not in extras/) so the table is born with it.
-- UPDATE and DELETE are rejected per row with SQLSTATE P0001. TRUNCATE is a
-- statement, not a row operation, and stays allowed: the integration suites
-- wipe every table with TRUNCATE between tests, and no application code
-- path issues one.
CREATE OR REPLACE FUNCTION "domain_event_reject_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION 'domain_event is append-only: % is not allowed', TG_OP
		USING ERRCODE = 'P0001';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "domain_event_append_only"
	BEFORE UPDATE OR DELETE ON "domain_event"
	FOR EACH ROW EXECUTE FUNCTION "domain_event_reject_mutation"();
