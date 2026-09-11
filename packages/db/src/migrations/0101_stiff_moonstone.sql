ALTER TABLE "billing_subscriptions" ADD COLUMN "courtesy_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD COLUMN "courtesy_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD COLUMN "courtesy_cycles_granted" integer;--> statement-breakpoint
CREATE INDEX "idx_subscriptions_courtesy_expiry" ON "billing_subscriptions" USING btree ("courtesy_ends_at") WHERE courtesy_ends_at IS NOT NULL;