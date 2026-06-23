CREATE TYPE "public"."accommodation_media_state_enum" AS ENUM('visible', 'archived');--> statement-breakpoint
CREATE TABLE "accommodation_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accommodation_id" uuid NOT NULL,
	"url" text NOT NULL,
	"caption" text,
	"description" text,
	"alt" text,
	"public_id" text,
	"attribution" jsonb,
	"moderation_state" "moderation_status_enum" DEFAULT 'PENDING' NOT NULL,
	"state" "accommodation_media_state_enum" DEFAULT 'visible' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "accommodation_media" ADD CONSTRAINT "accommodation_media_accommodation_id_accommodations_id_fk" FOREIGN KEY ("accommodation_id") REFERENCES "public"."accommodations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accommodationMedia_accommodationId_idx" ON "accommodation_media" USING btree ("accommodation_id");--> statement-breakpoint
CREATE INDEX "accommodationMedia_state_idx" ON "accommodation_media" USING btree ("state");--> statement-breakpoint
CREATE INDEX "accommodationMedia_isFeatured_idx" ON "accommodation_media" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "accommodationMedia_accommodationId_state_sortOrder_idx" ON "accommodation_media" USING btree ("accommodation_id","state","sort_order");--> statement-breakpoint
CREATE INDEX "accommodationMedia_deletedAt_idx" ON "accommodation_media" USING btree ("deleted_at");