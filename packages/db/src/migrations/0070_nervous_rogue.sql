CREATE TYPE "public"."experience_media_state_enum" AS ENUM('visible', 'archived');--> statement-breakpoint
CREATE TYPE "public"."gastronomy_media_state_enum" AS ENUM('visible', 'archived');--> statement-breakpoint
CREATE TABLE "experience_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experience_id" uuid NOT NULL,
	"url" text NOT NULL,
	"caption" text,
	"description" text,
	"alt" text,
	"public_id" text,
	"attribution" jsonb,
	"moderation_state" "moderation_status_enum" DEFAULT 'PENDING' NOT NULL,
	"state" "experience_media_state_enum" DEFAULT 'visible' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "gastronomy_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gastronomy_id" uuid NOT NULL,
	"url" text NOT NULL,
	"caption" text,
	"description" text,
	"alt" text,
	"public_id" text,
	"attribution" jsonb,
	"moderation_state" "moderation_status_enum" DEFAULT 'PENDING' NOT NULL,
	"state" "gastronomy_media_state_enum" DEFAULT 'visible' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "accommodations" ADD COLUMN "videos" jsonb;--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "videos" jsonb;--> statement-breakpoint
ALTER TABLE "gastronomies" ADD COLUMN "videos" jsonb;--> statement-breakpoint
ALTER TABLE "experience_media" ADD CONSTRAINT "experience_media_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastronomy_media" ADD CONSTRAINT "gastronomy_media_gastronomy_id_gastronomies_id_fk" FOREIGN KEY ("gastronomy_id") REFERENCES "public"."gastronomies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "experienceMedia_experienceId_idx" ON "experience_media" USING btree ("experience_id");--> statement-breakpoint
CREATE INDEX "experienceMedia_state_idx" ON "experience_media" USING btree ("state");--> statement-breakpoint
CREATE INDEX "experienceMedia_isFeatured_idx" ON "experience_media" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "experienceMedia_experienceId_state_sortOrder_idx" ON "experience_media" USING btree ("experience_id","state","sort_order");--> statement-breakpoint
CREATE INDEX "experienceMedia_deletedAt_idx" ON "experience_media" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "gastronomyMedia_gastronomyId_idx" ON "gastronomy_media" USING btree ("gastronomy_id");--> statement-breakpoint
CREATE INDEX "gastronomyMedia_state_idx" ON "gastronomy_media" USING btree ("state");--> statement-breakpoint
CREATE INDEX "gastronomyMedia_isFeatured_idx" ON "gastronomy_media" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "gastronomyMedia_gastronomyId_state_sortOrder_idx" ON "gastronomy_media" USING btree ("gastronomy_id","state","sort_order");--> statement-breakpoint
CREATE INDEX "gastronomyMedia_deletedAt_idx" ON "gastronomy_media" USING btree ("deleted_at");