-- =============================================================================
-- 006-conversation.indexes.sql
-- Consolidates:
--   0015_conversation_partial_indexes.sql
--
-- Creates partial unique indexes for the conversations and
-- conversation_notification_schedules tables that Drizzle cannot declare
-- natively (partial unique index support is not available in the Drizzle DSL).
--
-- Indexes:
--   1. conversations_userId_accommodationId_unique
--      At most 1 non-deleted conversation per (authenticated user, accommodation).
--   2. conversations_anonymousEmail_accommodationId_unique
--      At most 1 non-deleted, verified-email conversation per
--      (anonymous email, accommodation).
--   3. conv_notif_schedules_conversation_recipient_unique
--      At most 1 active (non-cancelled) notification schedule per
--      (conversation, recipient side).
--
-- Idempotency:
--   CREATE UNIQUE INDEX IF NOT EXISTS is used directly where safe.
--   DO blocks guard against missing tables.
--
-- Note on identifier case: PostgreSQL lowercases unquoted identifiers on
-- storage. The index names here use mixed case for readability but are stored
-- as lowercase in pg_indexes. IF NOT EXISTS comparisons work correctly.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. One active conversation per (authenticated user, accommodation)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'conversations'
  ) THEN
    RAISE NOTICE 'Table conversations does not exist, skipping conversations_userId_accommodationId_unique.';
    RETURN;
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS conversations_userId_accommodationId_unique
    ON conversations (user_id, accommodation_id)
    WHERE user_id IS NOT NULL
      AND deleted_at IS NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. One active verified-email conversation per (anonymous email, accommodation)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'conversations'
  ) THEN
    RAISE NOTICE 'Table conversations does not exist, skipping conversations_anonymousEmail_accommodationId_unique.';
    RETURN;
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS conversations_anonymousEmail_accommodationId_unique
    ON conversations (anonymous_email, accommodation_id)
    WHERE anonymous_email IS NOT NULL
      AND anonymous_email_verified = true
      AND deleted_at IS NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. One active notification schedule per (conversation, recipient side)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'conversation_notification_schedules'
  ) THEN
    RAISE NOTICE 'Table conversation_notification_schedules does not exist, skipping conv_notif_schedules_conversation_recipient_unique.';
    RETURN;
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS conv_notif_schedules_conversation_recipient_unique
    ON conversation_notification_schedules (conversation_id, recipient_side)
    WHERE cancelled_at IS NULL;
END;
$$;
