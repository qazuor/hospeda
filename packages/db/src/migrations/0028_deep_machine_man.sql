ALTER TABLE "amenities" ADD COLUMN "applicable_verticals" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "features" ADD COLUMN "applicable_verticals" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
-- SPEC-266 data backfill (idempotent on existing rows): the current catalog is
-- accommodation-authored. Default every existing item to the accommodation vertical so
-- live accommodation listings lose nothing (Q6), then promote the shared-core set that
-- actually exists to all three verticals. New shared items (smoke_free, accepts_cards)
-- are authored with their scope directly in the seed task (T-004).
UPDATE "amenities" SET "applicable_verticals" = ARRAY['accommodation'] WHERE "applicable_verticals" = '{}';--> statement-breakpoint
UPDATE "features" SET "applicable_verticals" = ARRAY['accommodation'] WHERE "applicable_verticals" = '{}';--> statement-breakpoint
UPDATE "amenities" SET "applicable_verticals" = ARRAY['accommodation','gastronomy','experience'] WHERE "slug" IN ('wifi','parking','pet_friendly','wheelchair_accessible','air_conditioning','terrace','security_parking','panoramic_view');--> statement-breakpoint
UPDATE "features" SET "applicable_verticals" = ARRAY['accommodation','gastronomy','experience'] WHERE "slug" IN ('bilingual_services','disability_accessible','tourist_info_available');--> statement-breakpoint
UPDATE "amenities" SET "applicable_verticals" = ARRAY['accommodation','experience'] WHERE "slug" = 'bicycles';--> statement-breakpoint
UPDATE "features" SET "applicable_verticals" = ARRAY['accommodation','gastronomy'] WHERE "slug" = 'smoking_area';--> statement-breakpoint
ALTER TABLE "amenities" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "features" DROP COLUMN "name";