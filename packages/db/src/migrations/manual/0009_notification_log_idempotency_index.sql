-- =============================================================================
-- 0009_notification_log_idempotency_index.sql
-- Purpose: Create a UNIQUE partial index on billing_notification_log using a
--          JSONB functional expression (metadata->>'idempotencyKey') to enforce
--          idempotency for notification delivery. Drizzle cannot declare
--          JSONB functional expression indexes natively.
-- Depends on: billing_notification_log table with metadata JSONB column.
-- Related commit: 1eb35632 (added inline to apply-postgres-extras.sh)
-- Date: 2026-04-18
-- =============================================================================

-- Partial unique index: only rows where idempotencyKey is present are indexed.
-- Allows multiple rows without an idempotency key (NULL case) while preventing
-- duplicate delivery for rows that carry a key.
-- Skips silently if the table does not exist (billing schema may not be present
-- in all environments).
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
