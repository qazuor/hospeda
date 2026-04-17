-- Migration: 0002_kind_wolfpack
-- Generated manually from schema diff (0002_snapshot -> current schema)
--
-- Changes:
--   billing_subscription_events:
--     - Add event_type column (varchar 100, nullable)
--     - Drop NOT NULL constraint from previous_status
--     - Drop NOT NULL constraint from new_status
--     - Add composite index idx_subscription_events_event_type
--
--   owner_promotions:
--     - Drop is_active column (boolean)
--     - Add lifecycle_state column (lifecycle_status_enum, NOT NULL, default 'ACTIVE')
--     - Drop index ownerPromotions_isActive_idx
--     - Drop index ownerPromotions_ownerId_isActive_idx
--     - Add index ownerPromotions_lifecycleState_idx
--     - Add index ownerPromotions_ownerId_lifecycleState_idx

--> statement-breakpoint
ALTER TABLE "billing_subscription_events" ADD COLUMN "event_type" varchar(100);
--> statement-breakpoint
ALTER TABLE "billing_subscription_events" ALTER COLUMN "previous_status" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "billing_subscription_events" ALTER COLUMN "new_status" DROP NOT NULL;
--> statement-breakpoint
CREATE INDEX "idx_subscription_events_event_type" ON "billing_subscription_events" ("event_type","subscription_id","created_at");
--> statement-breakpoint
DROP INDEX "ownerPromotions_isActive_idx";
--> statement-breakpoint
DROP INDEX "ownerPromotions_ownerId_isActive_idx";
--> statement-breakpoint
ALTER TABLE "owner_promotions" DROP COLUMN "is_active";
--> statement-breakpoint
ALTER TABLE "owner_promotions" ADD COLUMN "lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL;
--> statement-breakpoint
CREATE INDEX "ownerPromotions_lifecycleState_idx" ON "owner_promotions" ("lifecycle_state");
--> statement-breakpoint
CREATE INDEX "ownerPromotions_ownerId_lifecycleState_idx" ON "owner_promotions" ("owner_id","lifecycle_state");
