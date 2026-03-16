-- SPEC-044: Addon Purchase Schema Cleanup
-- T-002: Generate and review migration for billing_addon_purchases schema changes
--
-- Changes:
-- 1. Add deleted_at column (soft-delete support)
-- 2. Drop and recreate partial indexes with AND deleted_at IS NULL
-- 3. Rename column cancelled_at to canceled_at (American English)
-- 4. Data migration: standardize status value 'cancelled' -> 'canceled'

-- Step 1: Add deleted_at column (backward compatible, nullable)
ALTER TABLE "billing_addon_purchases" ADD COLUMN "deleted_at" TIMESTAMP WITH TIME ZONE;
--> statement-breakpoint

-- Step 2: Drop and recreate partial indexes with new condition including deleted_at IS NULL

-- Drop unique partial index
DROP INDEX IF EXISTS "idx_addon_purchases_active_unique";
--> statement-breakpoint

-- Recreate unique partial index with soft-delete guard
CREATE UNIQUE INDEX "idx_addon_purchases_active_unique"
  ON "billing_addon_purchases" ("customer_id", "addon_slug")
  WHERE status = 'active' AND deleted_at IS NULL;
--> statement-breakpoint

-- Drop active-customer partial index
DROP INDEX IF EXISTS "addonPurchases_active_customer_idx";
--> statement-breakpoint

-- Recreate active-customer partial index with soft-delete guard
CREATE INDEX "addonPurchases_active_customer_idx"
  ON "billing_addon_purchases" ("customer_id")
  WHERE status = 'active' AND deleted_at IS NULL;
--> statement-breakpoint

-- Step 3: Rename column cancelled_at to canceled_at (American English spelling)
ALTER TABLE "billing_addon_purchases" RENAME COLUMN "cancelled_at" TO "canceled_at";
--> statement-breakpoint

-- Step 4: Data migration - standardize status value from British to American English
UPDATE "billing_addon_purchases" SET "status" = 'canceled' WHERE "status" = 'cancelled';
