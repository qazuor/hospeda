-- =============================================================================
-- 004-billing.constraints.sql
-- Consolidates:
--   0007_billing_addon_purchases_status_check.sql       (status CHECK)
--   0008_billing_addon_purchases_jsonb_checks.sql       (JSONB array CHECK x2)
--   0009_notification_log_idempotency_index.sql         (UNIQUE partial functional index)
--   0010_billing_subscription_events_event_type_check.sql (event_type length CHECK)
--
-- Idempotency:
--   All blocks use DO $$ ... IF NOT EXISTS ... $$ guards on pg_constraint /
--   pg_indexes before executing the DDL. Tables that do not exist are silently
--   skipped with a NOTICE.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0007: billing_addon_purchases.status CHECK
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'billing_addon_purchases'
  ) THEN
    RAISE NOTICE 'Table billing_addon_purchases does not exist, skipping billing_addon_purchases_status_check.';
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

-- ---------------------------------------------------------------------------
-- 0008: billing_addon_purchases.limit_adjustments JSONB array CHECK
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 0008: billing_addon_purchases.entitlement_adjustments JSONB array CHECK
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 0009: billing_notification_log idempotency UNIQUE partial functional index
-- Partial unique index on (metadata->>'idempotencyKey') WHERE key IS NOT NULL.
-- Allows multiple rows without an idempotency key while preventing duplicate
-- delivery for rows that carry one.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'billing_notification_log'
  ) THEN
    RAISE NOTICE 'Table billing_notification_log does not exist, skipping idempotency index.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'billing_notification_log'
      AND indexname = 'idx_notification_log_idempotency_key'
  ) THEN
    EXECUTE $sql$
      CREATE UNIQUE INDEX idx_notification_log_idempotency_key
        ON billing_notification_log ((metadata->>'idempotencyKey'))
        WHERE metadata->>'idempotencyKey' IS NOT NULL
    $sql$;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 0010: billing_subscription_events.event_type length CHECK
-- Prevents empty strings and enforces the varchar(100) length at the DB level.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'billing_subscription_events'
  ) THEN
    RAISE NOTICE 'Table billing_subscription_events does not exist, skipping event_type check.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'billing_subscription_events_event_type_check'
      AND conrelid = 'billing_subscription_events'::regclass
  ) THEN
    ALTER TABLE billing_subscription_events
      ADD CONSTRAINT billing_subscription_events_event_type_check
      CHECK (event_type IS NULL OR (char_length(event_type) > 0 AND char_length(event_type) <= 100));
  END IF;
END;
$$;
