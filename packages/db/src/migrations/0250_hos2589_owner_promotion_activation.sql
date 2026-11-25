ALTER TABLE "owner_promotions" ADD COLUMN "first_activated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "owner_promotions" ADD COLUMN "vip_paused_at" timestamp with time zone;--> statement-breakpoint
-- HOS-2589 §7.7: rows that are ACTIVE today count as first activated when they
-- were created. Same release as the column, so the expand/contract trap does not apply.
UPDATE "owner_promotions" SET "first_activated_at" = "created_at" WHERE "lifecycle_state" = 'ACTIVE' AND "first_activated_at" IS NULL;
