-- =============================================================================
-- 007-messages.constraints.sql
-- Consolidates:
--   0016_messages_body_length_check.sql
--
-- Adds a CHECK constraint on messages.body enforcing a maximum of 5000
-- characters at the database level. Complements Zod validation in the service
-- layer and prevents oversized bodies from being inserted via direct DB access.
--
-- Idempotency:
--   DO block guards against missing table and existing constraint.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'messages'
  ) THEN
    RAISE NOTICE 'Table messages does not exist, skipping messages_body_length.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'messages_body_length'
      AND conrelid = 'messages'::regclass
  ) THEN
    ALTER TABLE messages
      ADD CONSTRAINT messages_body_length
      CHECK (char_length(body) <= 5000);
    RAISE NOTICE 'Added constraint messages_body_length.';
  END IF;
END;
$$;
