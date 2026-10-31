-- HOS-1943 (owner decision 01/11, option a): an experience "a consultar"
-- stores price_from = NULL instead of 0. Expand step only: the column stops
-- being NOT NULL and loses its DEFAULT 0. Both are safe while old code still
-- runs, because every old write supplies a price.
-- The backfill of existing on-request rows (0 -> NULL) is the seed
-- data-migration 0132-hos1943-price-on-request-null, run by db:seed:migrate.
-- The CHECK (is_price_on_request => price_from IS NULL) is deferred to the next
-- release: db:apply-extras runs before db:seed:migrate and would reject the
-- rows the backfill has not reached yet.
ALTER TABLE "experiences" ALTER COLUMN "price_from" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "experiences" ALTER COLUMN "price_from" DROP NOT NULL;