CREATE TABLE "featured_listing_addon_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_id" uuid NOT NULL,
	"accommodation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accommodations" RENAME COLUMN "featured_by_plan" TO "featured_by_entitlement";--> statement-breakpoint
DROP INDEX "accommodations_featuredByPlan_idx";--> statement-breakpoint
DROP INDEX "accommodations_visibility_featuredByPlan_idx";--> statement-breakpoint
DROP INDEX "accommodations_destinationId_featuredByPlan_visibility_idx";--> statement-breakpoint
ALTER TABLE "featured_listing_addon_grants" ADD CONSTRAINT "featured_listing_addon_grants_purchase_id_billing_addon_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."billing_addon_purchases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "featured_listing_addon_grants" ADD CONSTRAINT "featured_listing_addon_grants_accommodation_id_accommodations_id_fk" FOREIGN KEY ("accommodation_id") REFERENCES "public"."accommodations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "featuredListingAddonGrants_purchaseId_uniq" ON "featured_listing_addon_grants" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "featuredListingAddonGrants_accommodationId_idx" ON "featured_listing_addon_grants" USING btree ("accommodation_id");--> statement-breakpoint
CREATE INDEX "accommodations_featuredByEntitlement_idx" ON "accommodations" USING btree ("featured_by_entitlement");--> statement-breakpoint
CREATE INDEX "accommodations_visibility_featuredByEntitlement_idx" ON "accommodations" USING btree ("visibility","featured_by_entitlement");--> statement-breakpoint
CREATE INDEX "accommodations_destinationId_featuredByEntitlement_visibility_idx" ON "accommodations" USING btree ("destination_id","featured_by_entitlement","visibility");
