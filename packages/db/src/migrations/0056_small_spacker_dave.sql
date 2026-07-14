CREATE TYPE "public"."occupancy_source_enum" AS ENUM('MANUAL', 'GOOGLE_CALENDAR', 'AIRBNB', 'BOOKING');--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'accommodation.occupancy.manage' BEFORE 'accommodation.basicInfo.edit';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'accommodation.occupancy.view' BEFORE 'accommodation.basicInfo.edit';--> statement-breakpoint
CREATE TABLE "accommodation_occupancy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accommodation_id" uuid NOT NULL,
	"date" date NOT NULL,
	"is_blocked" boolean DEFAULT true NOT NULL,
	"source" "occupancy_source_enum" NOT NULL,
	"external_event_id" varchar(255),
	"note" varchar(500),
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accommodation_occupancy" ADD CONSTRAINT "accommodation_occupancy_accommodation_id_accommodations_id_fk" FOREIGN KEY ("accommodation_id") REFERENCES "public"."accommodations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_occupancy" ADD CONSTRAINT "accommodation_occupancy_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accommodationOccupancy_accommodationId_date_uq" ON "accommodation_occupancy" USING btree ("accommodation_id","date");