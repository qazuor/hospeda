CREATE TABLE "location_exception_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(32) NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" varchar(16) NOT NULL,
	"actor_id" uuid,
	"reason" text,
	"location_key" text,
	"request_id" uuid,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "location_exception_event_entity_type_check" CHECK ("location_exception_event"."entity_type" IN ('accommodation', 'venue')),
	CONSTRAINT "location_exception_event_action_check" CHECK ("location_exception_event"."action" IN ('REQUESTED', 'APPROVED', 'REJECTED', 'GRANTED', 'REVOKED', 'SUPERSEDED'))
);
--> statement-breakpoint
CREATE TABLE "location_exception_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(32) NOT NULL,
	"entity_id" uuid NOT NULL,
	"requested_by" uuid,
	"location_key" text NOT NULL,
	"target_location" jsonb,
	"reason" text NOT NULL,
	"status" varchar(16) DEFAULT 'PENDING' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_reason" text,
	CONSTRAINT "location_exception_request_entity_type_check" CHECK ("location_exception_request"."entity_type" IN ('accommodation', 'venue')),
	CONSTRAINT "location_exception_request_status_check" CHECK ("location_exception_request"."status" IN ('PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED'))
);
--> statement-breakpoint
ALTER TABLE "location_exception_request" ADD CONSTRAINT "location_exception_request_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_exception_request" ADD CONSTRAINT "location_exception_request_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "location_exception_event_entity_idx" ON "location_exception_event" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "location_exception_request_one_pending_uidx" ON "location_exception_request" USING btree ("entity_type","entity_id") WHERE "location_exception_request"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "location_exception_request_entity_idx" ON "location_exception_request" USING btree ("entity_type","entity_id","requested_at");--> statement-breakpoint
CREATE INDEX "location_exception_request_status_idx" ON "location_exception_request" USING btree ("entity_type","status","requested_at");