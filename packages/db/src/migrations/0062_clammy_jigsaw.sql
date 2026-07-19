CREATE TABLE "billing_pending_checkouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_subscription_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"plan_id" varchar(255) NOT NULL,
	"mp_preapproval_plan_id" varchar(255) NOT NULL,
	"nonce" varchar(64) NOT NULL,
	"payer_email" varchar(255),
	"pending_discount" jsonb,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_mp_plans" ADD COLUMN "init_point" varchar(500);--> statement-breakpoint
ALTER TABLE "billing_pending_checkouts" ADD CONSTRAINT "billing_pending_checkouts_local_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("local_subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_pending_checkouts" ADD CONSTRAINT "billing_pending_checkouts_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billingPendingCheckouts_nonce_uniq" ON "billing_pending_checkouts" USING btree ("nonce");--> statement-breakpoint
CREATE INDEX "billingPendingCheckouts_customerId_status_idx" ON "billing_pending_checkouts" USING btree ("customer_id","status");--> statement-breakpoint
CREATE INDEX "billingPendingCheckouts_mpPreapprovalPlanId_status_idx" ON "billing_pending_checkouts" USING btree ("mp_preapproval_plan_id","status");