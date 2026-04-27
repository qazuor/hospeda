-- =============================================================================
-- 0015_conversation_partial_indexes.sql
-- Purpose: Create partial unique indexes for the conversations and
--          conversation_notification_schedules tables that Drizzle cannot
--          declare natively (partial unique index support is not available in
--          the Drizzle schema DSL).
--
-- Indexes created:
--   1. conversations_userId_accommodationId_unique
--      Enforces at most 1 non-deleted conversation per (authenticated user,
--      accommodation) pair.
--   2. conversations_anonymousEmail_accommodationId_unique
--      Enforces at most 1 non-deleted, verified-email conversation per
--      (anonymous email, accommodation) pair.
--   3. conv_notif_schedules_conversation_recipient_unique
--      Enforces at most 1 active (non-cancelled) notification schedule per
--      (conversation, recipient side) pair.
--
-- Depends on: conversations and conversation_notification_schedules tables
--             must exist (created by drizzle-kit push).
-- Spec: SPEC-085, T-002
-- Date: 2026-04-26
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
    RAISE NOTICE 'Table conversations does not exist, skipping partial indexes.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'conversations'
      AND indexname = 'conversations_userId_accommodationId_unique'
  ) THEN
    CREATE UNIQUE INDEX conversations_userId_accommodationId_unique
      ON conversations (user_id, accommodation_id)
      WHERE user_id IS NOT NULL
        AND deleted_at IS NULL;
    RAISE NOTICE 'Created index conversations_userId_accommodationId_unique.';
  END IF;
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
    RAISE NOTICE 'Table conversations does not exist, skipping partial indexes.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'conversations'
      AND indexname = 'conversations_anonymousEmail_accommodationId_unique'
  ) THEN
    CREATE UNIQUE INDEX conversations_anonymousEmail_accommodationId_unique
      ON conversations (anonymous_email, accommodation_id)
      WHERE anonymous_email IS NOT NULL
        AND anonymous_email_verified = true
        AND deleted_at IS NULL;
    RAISE NOTICE 'Created index conversations_anonymousEmail_accommodationId_unique.';
  END IF;
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
    RAISE NOTICE 'Table conversation_notification_schedules does not exist, skipping partial index.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'conversation_notification_schedules'
      AND indexname = 'conv_notif_schedules_conversation_recipient_unique'
  ) THEN
    CREATE UNIQUE INDEX conv_notif_schedules_conversation_recipient_unique
      ON conversation_notification_schedules (conversation_id, recipient_side)
      WHERE cancelled_at IS NULL;
    RAISE NOTICE 'Created index conv_notif_schedules_conversation_recipient_unique.';
  END IF;
END;
$$;
