-- HOS-1810: a location exception is bound to the address it was granted for.
-- `location_exception_key` stores the `location_key` at grant time; the exception is
-- in force only while `location_key` still equals it, so moving the listing to another
-- address ends the exemption on any write path. The two partial unique indexes are
-- recreated with that predicate.
-- No data migration is needed: there are no live exceptions yet (the feature ships with
-- migration 0205), and the location_key backfill (seed 0174) is unaffected.
DROP INDEX "accommodations_ownerId_locationKey_published_uniq";--> statement-breakpoint
DROP INDEX "venues_ownerId_locationKey_published_uniq";--> statement-breakpoint
ALTER TABLE "accommodations" ADD COLUMN "location_exception_key" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "location_exception_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "accommodations_ownerId_locationKey_published_uniq" ON "accommodations" USING btree ("owner_id","location_key") WHERE "accommodations"."publication_status" = 'PUBLISHED' AND "accommodations"."deleted_at" IS NULL AND "accommodations"."location_key" IS NOT NULL AND ("accommodations"."location_exception_at" IS NULL OR "accommodations"."location_exception_key" IS DISTINCT FROM "accommodations"."location_key");--> statement-breakpoint
CREATE UNIQUE INDEX "venues_ownerId_locationKey_published_uniq" ON "venues" USING btree ("owner_id","location_key") WHERE "venues"."publication_status" = 'PUBLISHED' AND "venues"."deleted_at" IS NULL AND "venues"."location_key" IS NOT NULL AND ("venues"."location_exception_at" IS NULL OR "venues"."location_exception_key" IS DISTINCT FROM "venues"."location_key");