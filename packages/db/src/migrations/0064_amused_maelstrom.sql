CREATE TABLE "billing_plan_price_change_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"price_change_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"mp_subscription_id" varchar(255),
	"target_amount" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"last_attempt_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_plan_price_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"price_id" uuid NOT NULL,
	"billing_interval" varchar(10) NOT NULL,
	"old_amount" integer NOT NULL,
	"new_amount" integer NOT NULL,
	"direction" varchar(10) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"notice_sent_at" timestamp with time zone,
	"effective_at" timestamp with time zone NOT NULL,
	"actor_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_plan_price_change_targets" ADD CONSTRAINT "billing_plan_price_change_targets_price_change_id_billing_plan_price_changes_id_fk" FOREIGN KEY ("price_change_id") REFERENCES "public"."billing_plan_price_changes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_plan_price_change_targets" ADD CONSTRAINT "billing_plan_price_change_targets_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_plan_price_changes" ADD CONSTRAINT "billing_plan_price_changes_plan_id_billing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_plan_price_changes" ADD CONSTRAINT "billing_plan_price_changes_price_id_billing_prices_id_fk" FOREIGN KEY ("price_id") REFERENCES "public"."billing_prices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "planPriceChangeTargets_change_sub_uniq" ON "billing_plan_price_change_targets" USING btree ("price_change_id","subscription_id");--> statement-breakpoint
CREATE INDEX "planPriceChangeTargets_priceChangeId_idx" ON "billing_plan_price_change_targets" USING btree ("price_change_id");--> statement-breakpoint
CREATE INDEX "planPriceChangeTargets_subscriptionId_idx" ON "billing_plan_price_change_targets" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "planPriceChangeTargets_pending_idx" ON "billing_plan_price_change_targets" USING btree ("price_change_id") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "planPriceChanges_planId_idx" ON "billing_plan_price_changes" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "planPriceChanges_due_idx" ON "billing_plan_price_changes" USING btree ("effective_at") WHERE status IN ('pending', 'applying');