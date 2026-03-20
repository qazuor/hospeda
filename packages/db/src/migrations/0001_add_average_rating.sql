ALTER TABLE "accommodation_reviews" ADD COLUMN "average_rating" numeric(3, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "destination_reviews" ADD COLUMN "average_rating" numeric(3, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint

-- Backfill accommodation_reviews from JSONB (6 dimensions)
UPDATE "accommodation_reviews" SET "average_rating" = (
    (COALESCE(("rating"->>'cleanliness')::numeric, 0) +
     COALESCE(("rating"->>'hospitality')::numeric, 0) +
     COALESCE(("rating"->>'services')::numeric, 0) +
     COALESCE(("rating"->>'accuracy')::numeric, 0) +
     COALESCE(("rating"->>'communication')::numeric, 0) +
     COALESCE(("rating"->>'location')::numeric, 0)) / 6.0
);--> statement-breakpoint

-- Backfill destination_reviews from JSONB (18 dimensions, dynamic average)
UPDATE "destination_reviews" SET "average_rating" = COALESCE(
    (SELECT AVG(val::numeric)
     FROM jsonb_each_text("rating") AS kv(key, val)
     WHERE val IS NOT NULL),
    0
) WHERE "rating" IS NOT NULL;
