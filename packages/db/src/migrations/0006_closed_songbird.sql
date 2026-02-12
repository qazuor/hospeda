ALTER TABLE "billing_notification_log" DROP CONSTRAINT "billing_notification_log_customer_id_billing_customers_id_fk";
--> statement-breakpoint
ALTER TABLE "owner_promotions" ALTER COLUMN "discount_value" SET DATA TYPE integer;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notificationLog_expiredAt_idx" ON "billing_notification_log" ("expired_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsorshipLevels_slug_idx" ON "sponsorship_levels" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsorshipLevels_sortOrder_idx" ON "sponsorship_levels" ("sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsorshipLevels_targetType_tier_idx" ON "sponsorship_levels" ("target_type","tier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsorshipPackages_slug_idx" ON "sponsorship_packages" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsorshipPackages_sortOrder_idx" ON "sponsorship_packages" ("sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsorshipPackages_isActive_deletedAt_idx" ON "sponsorship_packages" ("is_active","deleted_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_notification_log" ADD CONSTRAINT "billing_notification_log_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing_customers"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
