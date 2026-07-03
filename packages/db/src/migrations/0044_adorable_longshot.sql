-- HOS-73: qzpay-drizzle bump 1.9.1 -> 1.11.0 promotes 9 columns that
-- previously only existed via Hospeda's own extras carril (016-019,
-- product_domain/promo_effect_remaining_cycles/effect_kind/value_kind/
-- duration_cycles/extra_days) or via an untracked manual action in local
-- dev (display_name/monthly_price_ars/annual_price_ars — no matching extras
-- file exists for these three) to first-class Drizzle-declared columns.
-- Hand-edited to add IF NOT EXISTS (existing DBs already have most of
-- these) and placeholder DEFAULTs for the two NOT NULL columns the
-- upstream schema itself doesn't default (display_name, monthly_price_ars)
-- so the ALTER succeeds against tables that already have rows, whether or
-- not the column is new there. See packages/db/CLAUDE.md hand-edit workflow.

ALTER TABLE "billing_plans" ADD COLUMN IF NOT EXISTS "display_name" varchar(255) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "billing_plans" ADD COLUMN IF NOT EXISTS "monthly_price_ars" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "billing_plans" ADD COLUMN IF NOT EXISTS "annual_price_ars" integer;--> statement-breakpoint
ALTER TABLE "billing_plans" ADD COLUMN IF NOT EXISTS "product_domain" varchar(32) DEFAULT 'accommodation' NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_promo_codes" ADD COLUMN IF NOT EXISTS "effect_kind" varchar(30) DEFAULT 'discount' NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_promo_codes" ADD COLUMN IF NOT EXISTS "value_kind" varchar(20);--> statement-breakpoint
ALTER TABLE "billing_promo_codes" ADD COLUMN IF NOT EXISTS "duration_cycles" integer;--> statement-breakpoint
ALTER TABLE "billing_promo_codes" ADD COLUMN IF NOT EXISTS "extra_days" integer;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD COLUMN IF NOT EXISTS "product_domain" varchar(32) DEFAULT 'accommodation' NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD COLUMN IF NOT EXISTS "promo_effect_remaining_cycles" integer;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_plans_product_domain" ON "billing_plans" USING btree ("product_domain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_promo_codes_effect_kind" ON "billing_promo_codes" USING btree ("effect_kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscriptions_product_domain" ON "billing_subscriptions" USING btree ("product_domain");