-- =============================================================================
-- 0007_billing_addon_purchases_status_check.sql
-- Purpose: Add CHECK constraint billing_addon_purchases_status_check to
--          billing_addon_purchases.status to enforce valid status values at
--          the database level (complement to Zod validation in service layer).
-- Depends on: billing_addon_purchases table must exist.
-- Previously documented as: 0025_addon_purchases_status_check.sql in ADR-017
-- Related commit: f9e0d338 (deleted); idempotent form from apply-postgres-extras.sh
-- Date: 2026-04-18
-- =============================================================================

-- Idempotent: skips silently if the table does not exist or constraint already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'billing_addon_purchases'
  ) THEN
    RAISE NOTICE 'Table billing_addon_purchases does not exist, skipping constraint.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'billing_addon_purchases_status_check'
      AND conrelid = 'billing_addon_purchases'::regclass
  ) THEN
    ALTER TABLE billing_addon_purchases
      ADD CONSTRAINT billing_addon_purchases_status_check
      CHECK (status IN ('active', 'expired', 'canceled', 'pending'));
  END IF;
END;
$$;
