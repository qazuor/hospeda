CREATE TYPE "public"."tourist_audience_enum" AS ENUM('plus', 'vip');--> statement-breakpoint
ALTER TABLE "owner_promotions" ADD COLUMN "tourist_audience" "tourist_audience_enum" DEFAULT 'plus' NOT NULL;--> statement-breakpoint
CREATE INDEX "ownerPromotions_touristAudience_idx" ON "owner_promotions" USING btree ("tourist_audience");