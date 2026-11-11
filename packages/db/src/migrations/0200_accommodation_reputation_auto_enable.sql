ALTER TABLE "accommodations" ADD COLUMN "external_reputation_toggle_decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accommodations" ADD COLUMN "external_reputation_auto_enabled_at" timestamp with time zone;--> statement-breakpoint
-- Not retroactive (owner decision): an accommodation that ALREADY has a working
-- provider while its section is off has an owner who may have left it off on
-- purpose, and nothing recorded that choice before this column existed. Stamp
-- those rows as decided so the auto-enable never overrides them. Accommodations
-- with no working provider yet stay undecided and remain eligible.
-- `snippets` is jsonb and may hold a JSON null (not SQL NULL), on which
-- jsonb_array_length raises; the CASE guards it regardless of evaluation order.
UPDATE "accommodations" AS a
SET "external_reputation_toggle_decided_at" = now()
WHERE a."show_external_reputation" = false
  AND a."external_reputation_toggle_decided_at" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "accommodation_external_reputation" AS r
    JOIN "accommodation_external_listings" AS l ON l."id" = r."listing_id"
    WHERE r."accommodation_id" = a."id"
      AND r."fetch_status" = 'ok'
      AND (
        r."rating" IS NOT NULL
        OR (CASE WHEN jsonb_typeof(r."snippets") = 'array' THEN jsonb_array_length(r."snippets") ELSE 0 END) > 0
      )
      AND l."deleted_at" IS NULL
      AND (l."show_link" OR l."show_reviews")
  );
