CREATE TYPE "public"."owner_promotion_entity_type_enum" AS ENUM('accommodation', 'venue');--> statement-breakpoint
ALTER TABLE "owner_promotions" ADD COLUMN "entity_type" "owner_promotion_entity_type_enum" DEFAULT 'accommodation' NOT NULL;--> statement-breakpoint
ALTER TABLE "owner_promotions" ADD COLUMN "entity_id" uuid;--> statement-breakpoint
CREATE INDEX "ownerPromotions_entityType_entityId_idx" ON "owner_promotions" USING btree ("entity_type","entity_id");--> statement-breakpoint
ALTER TABLE "owner_promotions" ADD CONSTRAINT "owner_promotions_venue_requires_entity_check" CHECK ("owner_promotions"."entity_type" <> 'venue' OR "owner_promotions"."entity_id" IS NOT NULL);