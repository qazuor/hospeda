CREATE TABLE "billing_dunning_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"result" varchar(50) NOT NULL,
	"amount" integer,
	"currency" varchar(3),
	"payment_id" uuid,
	"failure_code" varchar(100),
	"error_message" text,
	"provider" varchar(50) DEFAULT 'mercadopago' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_dunning_attempts" ADD CONSTRAINT "billing_dunning_attempts_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_dunning_attempts" ADD CONSTRAINT "billing_dunning_attempts_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dunningAttempts_subscriptionId_idx" ON "billing_dunning_attempts" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "dunningAttempts_customerId_idx" ON "billing_dunning_attempts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "dunningAttempts_result_idx" ON "billing_dunning_attempts" USING btree ("result");--> statement-breakpoint
CREATE INDEX "dunningAttempts_subscription_attempt_idx" ON "billing_dunning_attempts" USING btree ("subscription_id","attempt_number");--> statement-breakpoint
CREATE INDEX "dunningAttempts_customer_result_idx" ON "billing_dunning_attempts" USING btree ("customer_id","result");--> statement-breakpoint
CREATE INDEX "dunningAttempts_recent_idx" ON "billing_dunning_attempts" USING btree ("attempted_at") WHERE result = 'failed';--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_lifecycleState_idx" ON "users" USING btree ("lifecycle_state");--> statement-breakpoint
CREATE INDEX "users_visibility_idx" ON "users" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "users_deletedAt_idx" ON "users" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "users_createdAt_idx" ON "users" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "users_role_deletedAt_idx" ON "users" USING btree ("role","deleted_at");--> statement-breakpoint
CREATE INDEX "users_lifecycleState_deletedAt_idx" ON "users" USING btree ("lifecycle_state","deleted_at");