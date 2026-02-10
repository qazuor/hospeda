ALTER TABLE "billing_notification_log" ADD COLUMN "expired_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "addonPurchases_active_customer_idx" ON "billing_addon_purchases" ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notificationLog_status_created_idx" ON "billing_notification_log" ("status","created_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_addon_purchases" ADD CONSTRAINT "billing_addon_purchases_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "billing_subscriptions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_addon_purchases" ADD CONSTRAINT "billing_addon_purchases_addon_id_billing_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "billing_addons"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_notification_log" ADD CONSTRAINT "billing_notification_log_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing_customers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
