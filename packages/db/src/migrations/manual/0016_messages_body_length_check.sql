-- =============================================================================
-- 0016_messages_body_length_check.sql
-- Purpose: Add CHECK constraint messages_body_length to messages.body to
--          enforce a maximum of 5 000 characters at the database level.
--          This complements the Zod validation in the service layer and
--          prevents oversized bodies from being inserted via direct DB access.
--          Drizzle does not support CHECK constraints on text columns via
--          its schema DSL without using raw sql`` expressions that may not
--          survive drizzle-kit push cycles cleanly.
-- Depends on: messages table must exist (created by drizzle-kit push).
-- Spec: SPEC-085, T-002
-- Date: 2026-04-26
-- =============================================================================

-- Idempotent: skips silently if the table does not exist or the constraint
-- already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'messages'
  ) THEN
    RAISE NOTICE 'Table messages does not exist, skipping body length check.';
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
