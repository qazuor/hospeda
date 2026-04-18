ALTER TYPE "public"."permission_category_enum" ADD VALUE 'MEDIA';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'media.upload';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'media.delete';--> statement-breakpoint
DROP INDEX "dunningAttempts_subscription_attempt_idx";--> statement-breakpoint
ALTER TABLE "billing_dunning_attempts" ALTER COLUMN "subscription_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_promo_codes" ADD COLUMN "max_uses_per_user" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_addon_purchases_entitlement_removal_pending" ON "billing_addon_purchases" USING btree ("customer_id","status") WHERE entitlement_removal_pending = true;--> statement-breakpoint
CREATE INDEX "idx_addon_purchases_needs_entitlement_sync" ON "billing_addon_purchases" USING btree ("customer_id","status") WHERE needs_entitlement_sync = true;--> statement-breakpoint
CREATE UNIQUE INDEX "promo_code_usage_customer_promo_unique" ON "billing_promo_code_usage" USING btree ("customer_id","promo_code_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dunningAttempts_subscription_attempt_idx" ON "billing_dunning_attempts" USING btree ("subscription_id","attempt_number") WHERE subscription_id IS NOT NULL;