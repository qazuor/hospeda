--> HOS-1286 CONTRACT step. Safe to run in the same batch as the 0122 EXPAND
--> because `db:migrate` applies pending migrations in order, and 0122 has
--> already copied every `accommodation_id` into `entity_id` and stamped
--> `entity_type = 'accommodation'` before this drop.
ALTER TABLE "featured_listing_addon_grants" DROP COLUMN "accommodation_id";
