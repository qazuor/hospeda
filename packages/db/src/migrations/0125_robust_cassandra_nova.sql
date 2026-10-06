ALTER TABLE "billing_addon_purchases" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_dunning_attempts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_mp_addon_plans" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_mp_plans" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_orphan_payments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_pending_checkouts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_plan_price_change_notices" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_plan_price_change_targets" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_plan_price_changes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_settings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_subscription_events" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "entity_subscriptions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "featured_listing_addon_grants" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "partner_subscriptions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_addons" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_audit_logs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_checkouts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_customer_entitlements" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_customer_limits" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_customers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_entitlements" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_idempotency_keys" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_invoice_lines" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_invoice_payments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_invoices" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_limits" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_payment_methods" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_payments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_plans" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_prices" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_promo_code_usage" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_promo_codes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_refunds" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_subscription_addons" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_subscription_polling_jobs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_usage_records" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_vendor_payouts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_vendors" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_webhook_dead_letter" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_webhook_events" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Hand-reordered (HOS-1416): the FK drops must run BEFORE the DROP TABLE ...
-- CASCADE block below. `DROP TABLE ... CASCADE` already removes referencing FK
-- constraints as a side effect, so dropping them afterwards would fail with
-- "constraint does not exist". Explicit drops first keep the migration
-- deterministic about which surviving-table FKs are removed:
--   * billing_notification_log.customer_id -> billing_customers (column is
--     dropped later in this file; the table itself SURVIVES)
--   * partners.plan_id -> billing_plans (column SURVIVES, FK cannot)
--   * partners.subscription_id -> billing_subscriptions (column SURVIVES, FK cannot)
ALTER TABLE "billing_notification_log" DROP CONSTRAINT "billing_notification_log_customer_id_billing_customers_id_fk";
--> statement-breakpoint
ALTER TABLE "partners" DROP CONSTRAINT "partners_plan_id_billing_plans_id_fk";
--> statement-breakpoint
ALTER TABLE "partners" DROP CONSTRAINT "partners_subscription_id_billing_subscriptions_id_fk";
--> statement-breakpoint
DROP TABLE "billing_addon_purchases" CASCADE;--> statement-breakpoint
DROP TABLE "billing_dunning_attempts" CASCADE;--> statement-breakpoint
DROP TABLE "billing_mp_addon_plans" CASCADE;--> statement-breakpoint
DROP TABLE "billing_mp_plans" CASCADE;--> statement-breakpoint
DROP TABLE "billing_orphan_payments" CASCADE;--> statement-breakpoint
DROP TABLE "billing_pending_checkouts" CASCADE;--> statement-breakpoint
DROP TABLE "billing_plan_price_change_notices" CASCADE;--> statement-breakpoint
DROP TABLE "billing_plan_price_change_targets" CASCADE;--> statement-breakpoint
DROP TABLE "billing_plan_price_changes" CASCADE;--> statement-breakpoint
DROP TABLE "billing_settings" CASCADE;--> statement-breakpoint
DROP TABLE "billing_subscription_events" CASCADE;--> statement-breakpoint
DROP TABLE "entity_subscriptions" CASCADE;--> statement-breakpoint
DROP TABLE "featured_listing_addon_grants" CASCADE;--> statement-breakpoint
DROP TABLE "partner_subscriptions" CASCADE;--> statement-breakpoint
DROP TABLE "billing_addons" CASCADE;--> statement-breakpoint
DROP TABLE "billing_audit_logs" CASCADE;--> statement-breakpoint
DROP TABLE "billing_checkouts" CASCADE;--> statement-breakpoint
DROP TABLE "billing_customer_entitlements" CASCADE;--> statement-breakpoint
DROP TABLE "billing_customer_limits" CASCADE;--> statement-breakpoint
DROP TABLE "billing_customers" CASCADE;--> statement-breakpoint
DROP TABLE "billing_entitlements" CASCADE;--> statement-breakpoint
DROP TABLE "billing_idempotency_keys" CASCADE;--> statement-breakpoint
DROP TABLE "billing_invoice_lines" CASCADE;--> statement-breakpoint
DROP TABLE "billing_invoice_payments" CASCADE;--> statement-breakpoint
DROP TABLE "billing_invoices" CASCADE;--> statement-breakpoint
DROP TABLE "billing_limits" CASCADE;--> statement-breakpoint
DROP TABLE "billing_payment_methods" CASCADE;--> statement-breakpoint
DROP TABLE "billing_payments" CASCADE;--> statement-breakpoint
DROP TABLE "billing_plans" CASCADE;--> statement-breakpoint
DROP TABLE "billing_prices" CASCADE;--> statement-breakpoint
DROP TABLE "billing_promo_code_usage" CASCADE;--> statement-breakpoint
DROP TABLE "billing_promo_codes" CASCADE;--> statement-breakpoint
DROP TABLE "billing_refunds" CASCADE;--> statement-breakpoint
DROP TABLE "billing_subscription_addons" CASCADE;--> statement-breakpoint
DROP TABLE "billing_subscription_polling_jobs" CASCADE;--> statement-breakpoint
DROP TABLE "billing_subscriptions" CASCADE;--> statement-breakpoint
DROP TABLE "billing_usage_records" CASCADE;--> statement-breakpoint
DROP TABLE "billing_vendor_payouts" CASCADE;--> statement-breakpoint
DROP TABLE "billing_vendors" CASCADE;--> statement-breakpoint
DROP TABLE "billing_webhook_dead_letter" CASCADE;--> statement-breakpoint
DROP TABLE "billing_webhook_events" CASCADE;--> statement-breakpoint
-- customer_id indexes dropped explicitly before the column so the order is
-- deterministic regardless of the engine's implicit column-index cleanup.
DROP INDEX "notificationLog_customerId_idx";--> statement-breakpoint
DROP INDEX "notificationLog_customer_type_idx";--> statement-breakpoint
ALTER TABLE "billing_notification_log" DROP COLUMN "customer_id";--> statement-breakpoint
DROP TYPE "public"."billing_interval_enum";--> statement-breakpoint
DROP TYPE "public"."invoice_status_enum";--> statement-breakpoint
DROP TYPE "public"."payment_status_enum";--> statement-breakpoint
DROP TYPE "public"."refund_status_enum";--> statement-breakpoint
DROP TYPE "public"."subscription_status_enum";
