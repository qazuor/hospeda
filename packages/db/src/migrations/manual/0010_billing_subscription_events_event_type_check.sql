-- =============================================================================
-- 0010_billing_subscription_events_event_type_check.sql
-- Purpose: Add CHECK constraint billing_subscription_events_event_type_check to
--          billing_subscription_events.event_type. Prevents empty strings from
--          being stored and enforces the varchar(100) length at the DB level.
-- Depends on: billing_subscription_events table with event_type varchar(100).
-- Related commit: 1eb35632 (added to apply-postgres-extras.sh)
-- Date: 2026-04-18
-- =============================================================================

-- Idempotent: skips silently if the table does not exist or constraint already exists.
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
