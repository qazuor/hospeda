ALTER TABLE "accommodations" ADD COLUMN "plan_restricted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "owner_promotions" ADD COLUMN "plan_restricted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "accommodations_planRestricted_idx" ON "accommodations" USING btree ("plan_restricted");--> statement-breakpoint
CREATE INDEX "ownerPromotions_planRestricted_idx" ON "owner_promotions" USING btree ("plan_restricted");