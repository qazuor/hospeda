ALTER TABLE "points_of_interest" ALTER COLUMN "lat" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "points_of_interest" ALTER COLUMN "long" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "points_of_interest" ADD COLUMN "name_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "points_of_interest" ADD COLUMN "description_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "points_of_interest" ADD COLUMN "translation_meta" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "points_of_interest" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "points_of_interest" ADD COLUMN "keywords" text[];--> statement-breakpoint
ALTER TABLE "points_of_interest" ADD COLUMN "has_own_page" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "points_of_interest" ADD COLUMN "verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "points_of_interest" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "points_of_interest" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "points_of_interest" ADD COLUMN "notes" text;--> statement-breakpoint
CREATE INDEX "pointsOfInterest_verified_idx" ON "points_of_interest" USING btree ("verified");