DROP INDEX "billingMpPlans_variant_uniq";--> statement-breakpoint
ALTER TABLE "billing_mp_plans" ADD COLUMN "discount_cycle1_amount_ars" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "billingMpPlans_variant_uniq" ON "billing_mp_plans" USING btree ("commercial_plan_id","billing_interval","trial_days","discount_cycle1_amount_ars");