ALTER TABLE "owner_promotions" ADD COLUMN "window_weekdays" smallint[];--> statement-breakpoint
ALTER TABLE "owner_promotions" ADD COLUMN "window_start" time(0);--> statement-breakpoint
ALTER TABLE "owner_promotions" ADD COLUMN "window_end" time(0);--> statement-breakpoint
ALTER TABLE "owner_promotions" ADD CONSTRAINT "owner_promotions_window_venue_check" CHECK ("owner_promotions"."window_weekdays" IS NULL OR "owner_promotions"."entity_type" = 'venue');