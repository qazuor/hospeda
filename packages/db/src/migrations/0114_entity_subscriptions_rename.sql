ALTER TABLE "commerce_listing_subscriptions" RENAME TO "entity_subscriptions";--> statement-breakpoint
ALTER TABLE "entity_subscriptions" DROP CONSTRAINT "commerce_listing_subscriptions_subscription_id_billing_subscriptions_id_fk";
--> statement-breakpoint
ALTER TABLE "entity_subscriptions" ADD CONSTRAINT "entity_subscriptions_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP INDEX "commerce_listing_subs_entity_uniq";--> statement-breakpoint
DROP INDEX "commerce_listing_subs_entityId_idx";--> statement-breakpoint
DROP INDEX "commerce_listing_subs_status_idx";--> statement-breakpoint
ALTER TABLE "entity_subscriptions" ALTER COLUMN "subscription_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "entity_subscriptions" ADD COLUMN "plan_id" varchar(255);--> statement-breakpoint
CREATE UNIQUE INDEX "entity_subs_entity_uniq" ON "entity_subscriptions" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "entity_subs_entityId_idx" ON "entity_subscriptions" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "entity_subs_status_idx" ON "entity_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "entity_subs_subscriptionId_idx" ON "entity_subscriptions" USING btree ("subscription_id");