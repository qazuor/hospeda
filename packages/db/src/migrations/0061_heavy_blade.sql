CREATE TABLE "billing_mp_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commercial_plan_id" uuid NOT NULL,
	"billing_interval" varchar(20) NOT NULL,
	"mp_preapproval_plan_id" varchar(255) NOT NULL,
	"amount_ars" integer NOT NULL,
	"trial_days" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_mp_plans" ADD CONSTRAINT "billing_mp_plans_commercial_plan_id_billing_plans_id_fk" FOREIGN KEY ("commercial_plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billingMpPlans_variant_uniq" ON "billing_mp_plans" USING btree ("commercial_plan_id","billing_interval","trial_days");--> statement-breakpoint
CREATE UNIQUE INDEX "billingMpPlans_mpPreapprovalPlanId_uniq" ON "billing_mp_plans" USING btree ("mp_preapproval_plan_id");--> statement-breakpoint
CREATE INDEX "billingMpPlans_commercialPlanId_idx" ON "billing_mp_plans" USING btree ("commercial_plan_id");