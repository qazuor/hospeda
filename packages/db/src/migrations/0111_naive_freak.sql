CREATE TYPE "public"."gastronomy_event_recurrence_enum" AS ENUM('once', 'weekly');--> statement-breakpoint
CREATE TABLE "gastronomy_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gastronomy_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"recurrence" "gastronomy_event_recurrence_enum" NOT NULL,
	"date" date,
	"weekday" integer,
	"start_time" time NOT NULL,
	"end_time" time,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid
);
--> statement-breakpoint
ALTER TABLE "gastronomy_events" ADD CONSTRAINT "gastronomy_events_gastronomy_id_gastronomies_id_fk" FOREIGN KEY ("gastronomy_id") REFERENCES "public"."gastronomies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastronomy_events" ADD CONSTRAINT "gastronomy_events_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastronomy_events" ADD CONSTRAINT "gastronomy_events_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gastronomyEvents_gastronomyId_idx" ON "gastronomy_events" USING btree ("gastronomy_id");--> statement-breakpoint
CREATE INDEX "gastronomyEvents_gastronomyId_displayOrder_idx" ON "gastronomy_events" USING btree ("gastronomy_id","display_order");