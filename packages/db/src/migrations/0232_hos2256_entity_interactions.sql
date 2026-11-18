CREATE TYPE "public"."entity_interaction_kind_enum" AS ENUM('PHONE_CLICK', 'MAP_CLICK', 'WEBSITE_CLICK', 'INSTAGRAM_CLICK', 'TICKET_CLICK', 'WHATSAPP_CLICK', 'EVENT_IMPRESSION');--> statement-breakpoint
CREATE TABLE "entity_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "entity_type_enum" NOT NULL,
	"entity_id" uuid NOT NULL,
	"kind" "entity_interaction_kind_enum" NOT NULL,
	"event_id" uuid,
	"visitor_hash" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_interaction_monthly_rollups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "entity_type_enum" NOT NULL,
	"entity_id" uuid NOT NULL,
	"kind" "entity_interaction_kind_enum" NOT NULL,
	"event_id" uuid,
	"month" date NOT NULL,
	"total" integer NOT NULL,
	"unique_visitors" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entity_interactions" ADD CONSTRAINT "entity_interactions_event_id_venue_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."venue_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entityInteractions_entity_kind_occurredAt_idx" ON "entity_interactions" USING btree ("entity_type","entity_id","kind","occurred_at");--> statement-breakpoint
CREATE INDEX "entityInteractions_event_kind_occurredAt_idx" ON "entity_interactions" USING btree ("event_id","kind","occurred_at") WHERE "entity_interactions"."event_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "entityInteractions_occurredAt_idx" ON "entity_interactions" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "entityInteractionMonthlyRollups_key_uq" ON "entity_interaction_monthly_rollups" USING btree ("entity_type","entity_id","kind",coalesce("event_id", '00000000-0000-0000-0000-000000000000'::uuid),"month");