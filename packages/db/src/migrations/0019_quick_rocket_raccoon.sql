ALTER TYPE "public"."permission_category_enum" ADD VALUE 'METRICS' BEFORE 'PAYMENT';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'metrics.reset' BEFORE 'auditLog.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'userBookmark.viewAny' BEFORE 'benefitListing.create';--> statement-breakpoint
ALTER TABLE "billing_addon_purchases" DROP CONSTRAINT "billing_addon_purchases_addon_id_billing_addons_id_fk";
--> statement-breakpoint
ALTER TABLE "billing_dunning_attempts" DROP CONSTRAINT "billing_dunning_attempts_subscription_id_billing_subscriptions_id_fk";
--> statement-breakpoint
ALTER TABLE "billing_notification_log" DROP CONSTRAINT "billing_notification_log_customer_id_billing_customers_id_fk";
--> statement-breakpoint
DROP INDEX "dunningAttempts_subscription_attempt_idx";--> statement-breakpoint
DROP INDEX "idx_subscription_events_created_at";--> statement-breakpoint
ALTER TABLE "billing_dunning_attempts" ALTER COLUMN "payment_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "billing_dunning_attempts" ALTER COLUMN "metadata" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_subscription_events" ALTER COLUMN "metadata" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_addon_purchases" ADD CONSTRAINT "billing_addon_purchases_addon_id_billing_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."billing_addons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_dunning_attempts" ADD CONSTRAINT "billing_dunning_attempts_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_notification_log" ADD CONSTRAINT "billing_notification_log_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_settings" ADD CONSTRAINT "billing_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addonPurchases_entitlement_idx" ON "billing_addon_purchases" USING btree ("customer_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "billingSettings_updatedBy_idx" ON "billing_settings" USING btree ("updated_by");--> statement-breakpoint
CREATE UNIQUE INDEX "dunningAttempts_subscription_attempt_idx" ON "billing_dunning_attempts" USING btree ("subscription_id","attempt_number");--> statement-breakpoint
CREATE INDEX "idx_subscription_events_created_at" ON "billing_subscription_events" USING btree ("created_at" DESC NULLS LAST);