CREATE TYPE "public"."publication_status_enum" AS ENUM('DRAFT', 'PUBLISHED', 'UNPUBLISHED_BY_BILLING', 'ARCHIVED', 'MODERATED', 'PURGED');--> statement-breakpoint
CREATE TABLE "fix_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(32) NOT NULL,
	"entity_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"suggested_date" date,
	"owner_reported_fixed_at" timestamp with time zone,
	"opened_by_id" uuid NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fix_request_entity_type_check" CHECK ("fix_request"."entity_type" IN ('accommodation', 'gastronomy', 'experience')),
	CONSTRAINT "fix_request_closed_by_requires_closed_at_check" CHECK ("fix_request"."closed_by_id" IS NULL OR "fix_request"."closed_at" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "accommodations" ADD COLUMN "publication_status" "publication_status_enum";--> statement-breakpoint
ALTER TABLE "accommodations" ADD COLUMN "inactive_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accommodations" ADD COLUMN "deadlines_version" integer;--> statement-breakpoint
ALTER TABLE "accommodations" ADD COLUMN "deletion_announced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "publication_status" "publication_status_enum";--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "inactive_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "deadlines_version" integer;--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "deletion_announced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gastronomies" ADD COLUMN "publication_status" "publication_status_enum";--> statement-breakpoint
ALTER TABLE "gastronomies" ADD COLUMN "inactive_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gastronomies" ADD COLUMN "deadlines_version" integer;--> statement-breakpoint
ALTER TABLE "gastronomies" ADD COLUMN "deletion_announced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "fix_request" ADD CONSTRAINT "fix_request_opened_by_id_users_id_fk" FOREIGN KEY ("opened_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fix_request" ADD CONSTRAINT "fix_request_closed_by_id_users_id_fk" FOREIGN KEY ("closed_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fix_request_one_open_per_listing_uidx" ON "fix_request" USING btree ("entity_type","entity_id") WHERE "fix_request"."closed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "fix_request_entity_idx" ON "fix_request" USING btree ("entity_type","entity_id");