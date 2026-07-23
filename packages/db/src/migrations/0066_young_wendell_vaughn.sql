CREATE TABLE "billing_plan_price_change_notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"price_change_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"customer_id" uuid,
	"notified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_plan_price_change_notices" ADD CONSTRAINT "billing_plan_price_change_notices_price_change_id_billing_plan_price_changes_id_fk" FOREIGN KEY ("price_change_id") REFERENCES "public"."billing_plan_price_changes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_plan_price_change_notices" ADD CONSTRAINT "billing_plan_price_change_notices_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "planPriceChangeNotices_change_sub_uniq" ON "billing_plan_price_change_notices" USING btree ("price_change_id","subscription_id");--> statement-breakpoint
CREATE INDEX "planPriceChangeNotices_priceChangeId_idx" ON "billing_plan_price_change_notices" USING btree ("price_change_id");