DROP INDEX "billingMpPlans_variant_uniq";--> statement-breakpoint
ALTER TABLE "billing_mp_plans" ADD COLUMN "customer_scope" varchar(64) DEFAULT 'shared' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "billingMpPlans_variant_uniq" ON "billing_mp_plans" USING btree ("commercial_plan_id","billing_interval","trial_days","discount_cycle1_amount_ars","customer_scope");