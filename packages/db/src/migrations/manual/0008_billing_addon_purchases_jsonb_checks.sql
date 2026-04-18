-- =============================================================================
-- 0008_billing_addon_purchases_jsonb_checks.sql
-- Purpose: Add JSONB type CHECK constraints to billing_addon_purchases for the
--          limit_adjustments and entitlement_adjustments columns. Drizzle's
--          .check() builder cannot express expressions that call jsonb_typeof().
-- Depends on: billing_addon_purchases table must exist.
-- Previously documented as: 0026_addon_purchases_jsonb_check.sql in ADR-017
-- Related commit: f9e0d338 (deleted); SQL from apply-postgres-extras.sh
-- Date: 2026-04-18
-- =============================================================================

-- Constraint: limit_adjustments must be a JSON array or NULL.
-- Services that iterate limit_adjustments assume array semantics; a scalar or
-- object value would cause runtime failures.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'billing_addon_purchases'
  ) THEN
    RAISE NOTICE 'Table billing_addon_purchases does not exist, skipping chk_limit_adjustments_type.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_limit_adjustments_type'
      AND conrelid = 'billing_addon_purchases'::regclass
  ) THEN
    ALTER TABLE billing_addon_purchases
      ADD CONSTRAINT chk_limit_adjustments_type
      CHECK (limit_adjustments IS NULL OR jsonb_typeof(limit_adjustments) = 'array');
  END IF;
END;
$$;

-- Constraint: entitlement_adjustments must be a JSON array or NULL.
-- Same guarantee applied to the entitlements column.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'billing_addon_purchases'
  ) THEN
    RAISE NOTICE 'Table billing_addon_purchases does not exist, skipping chk_entitlement_adjustments_type.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_entitlement_adjustments_type'
      AND conrelid = 'billing_addon_purchases'::regclass
  ) THEN
    ALTER TABLE billing_addon_purchases
      ADD CONSTRAINT chk_entitlement_adjustments_type
      CHECK (entitlement_adjustments IS NULL OR jsonb_typeof(entitlement_adjustments) = 'array');
  END IF;
END;
$$;
