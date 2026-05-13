-- =============================================================================
-- 0022_newsletter_subscriber_unique_active.sql
--
-- SPEC-101: Partial UNIQUE on newsletter_subscribers(user_id, channel) that
-- only applies to rows where deleted_at IS NULL.
--
-- Why partial: a subscriber whose row was soft-deleted must be allowed to
-- subscribe again on the same channel. A plain UNIQUE would block that.
-- Drizzle cannot express partial unique indexes inline, hence this manual SQL.
--
-- Idempotent: IF NOT EXISTS guard re-applies cleanly under pnpm db:fresh-dev.
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_newsletter_subscribers_user_channel_active
    ON newsletter_subscribers (user_id, channel)
    WHERE deleted_at IS NULL;
