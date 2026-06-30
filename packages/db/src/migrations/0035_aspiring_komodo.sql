ALTER TABLE "accommodations" ADD COLUMN "featured_by_plan" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "accommodations_featuredByPlan_idx" ON "accommodations" USING btree ("featured_by_plan");--> statement-breakpoint
CREATE INDEX "accommodations_visibility_featuredByPlan_idx" ON "accommodations" USING btree ("visibility","featured_by_plan");--> statement-breakpoint
CREATE INDEX "accommodations_destinationId_featuredByPlan_visibility_idx" ON "accommodations" USING btree ("destination_id","featured_by_plan","visibility");