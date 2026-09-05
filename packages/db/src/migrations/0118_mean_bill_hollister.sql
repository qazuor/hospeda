CREATE TABLE "billing_mp_addon_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"addon_id" uuid NOT NULL,
	"billing_interval" varchar(20) NOT NULL,
	"mp_preapproval_plan_id" varchar(255) NOT NULL,
	"amount_ars" integer NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_addon_purchases" ADD COLUMN "mp_subscription_id" varchar(255);--> statement-breakpoint
ALTER TABLE "billing_addon_purchases" ADD COLUMN "current_period_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_addon_purchases" ADD COLUMN "current_period_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_addon_purchases" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_addon_purchases" ADD COLUMN "billing_interval" varchar(20);--> statement-breakpoint
ALTER TABLE "billing_mp_addon_plans" ADD CONSTRAINT "billing_mp_addon_plans_addon_id_billing_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."billing_addons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billingMpAddonPlans_variant_uniq" ON "billing_mp_addon_plans" USING btree ("addon_id","billing_interval");--> statement-breakpoint
CREATE UNIQUE INDEX "billingMpAddonPlans_mpPreapprovalPlanId_uniq" ON "billing_mp_addon_plans" USING btree ("mp_preapproval_plan_id");--> statement-breakpoint
CREATE INDEX "billingMpAddonPlans_addonId_idx" ON "billing_mp_addon_plans" USING btree ("addon_id");--> statement-breakpoint
CREATE INDEX "idx_addon_purchases_mp_subscription_id" ON "billing_addon_purchases" USING btree ("mp_subscription_id");