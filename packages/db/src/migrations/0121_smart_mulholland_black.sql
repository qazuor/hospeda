ALTER TABLE "billing_plans" ALTER COLUMN "product_domain" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ALTER COLUMN "product_domain" DROP DEFAULT;