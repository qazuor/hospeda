--> HOS-1286 EXPAND step. Hand-edited after `db:generate`, and the edit is the
--> whole point: drizzle-kit emitted the two new columns as bare
--> `ADD COLUMN ... NOT NULL`, which aborts on any table that already holds rows.
--> The statements below add them permissively, backfill, and only then tighten.
--> The final schema is byte-identical to what drizzle generated, so the meta
--> snapshot stays authoritative.
-->
--> The backfill is a CONSTANT, not a lookup: every pre-existing row reached this
--> table through a foreign key to `accommodations.id` (dropped on line 1 below),
--> so `entity_type = 'accommodation'` is correct for 100% of rows whatever the
--> row count is.
-->
--> `accommodation_id` is made NULLABLE here and deliberately NOT dropped. This
--> release is the one that stops reading it; the DROP belongs to the release
--> AFTER this one is actually deployed (HOS-601, docs/guides/migrations.md
--> "Deploy order"). Dropping it here would mean the still-running old container
--> — which projects an explicit column list, never `SELECT *` — reading a column
--> that no longer exists, for the length of the container swap. Migration 0090
--> did exactly that to `accommodations.schedule` and the public page served 404
--> for 8m10s. So this file only ever ADDS and WIDENS: it cannot lose data, and
--> it cannot break a deploy halfway through.
ALTER TABLE "featured_listing_addon_grants" DROP CONSTRAINT "featured_listing_addon_grants_accommodation_id_accommodations_id_fk";
--> statement-breakpoint
DROP INDEX "featuredListingAddonGrants_accommodationId_idx";--> statement-breakpoint
ALTER TABLE "featured_listing_addon_grants" ALTER COLUMN "accommodation_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "featured_listing_addon_grants" ADD COLUMN "entity_type" varchar(50) DEFAULT 'accommodation' NOT NULL;--> statement-breakpoint
ALTER TABLE "featured_listing_addon_grants" ADD COLUMN "entity_id" uuid;--> statement-breakpoint
UPDATE "featured_listing_addon_grants" SET "entity_id" = "accommodation_id" WHERE "entity_id" IS NULL;--> statement-breakpoint
--> No DELETE fallback on purpose: `accommodation_id` was NOT NULL until four
--> statements ago, so the UPDATE above cannot leave a NULL behind. If one
--> somehow exists, SET NOT NULL aborts the migration — which is the correct
--> outcome. A migration must never delete a paid grant to make itself pass.
ALTER TABLE "featured_listing_addon_grants" ALTER COLUMN "entity_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "featured_listing_addon_grants" ALTER COLUMN "entity_type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "featured_by_entitlement" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "gastronomies" ADD COLUMN "featured_by_entitlement" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "featuredListingAddonGrants_entity_idx" ON "featured_listing_addon_grants" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "experiences_featuredByEntitlement_idx" ON "experiences" USING btree ("featured_by_entitlement");--> statement-breakpoint
CREATE INDEX "gastronomies_featuredByEntitlement_idx" ON "gastronomies" USING btree ("featured_by_entitlement");
