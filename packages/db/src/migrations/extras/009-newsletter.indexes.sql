-- =============================================================================
-- 009-newsletter.indexes.sql
-- Consolidates:
--   0022_newsletter_subscriber_unique_active.sql          (partial unique index)
--   0023_newsletter_delivery_constraints.sql              (unique index + partial index)
--
-- Idempotency:
--   All indexes use CREATE ... IF NOT EXISTS directly.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0022: Partial unique index on newsletter_subscribers(user_id, channel)
-- WHERE deleted_at IS NULL.
-- Allows a soft-deleted subscriber to re-subscribe on the same channel.
-- Drizzle cannot express partial unique indexes inline, hence this manual SQL.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_newsletter_subscribers_user_channel_active
    ON newsletter_subscribers (user_id, channel)
    WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 0023: Unique index on newsletter_campaign_deliveries(campaign_id, subscriber_id, channel)
-- Guards idempotency: prevents duplicate delivery rows on retries or double-click.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_newsletter_deliveries_campaign_subscriber_channel
    ON newsletter_campaign_deliveries (campaign_id, subscriber_id, channel);

-- ---------------------------------------------------------------------------
-- 0023: Partial BTREE index on newsletter_campaign_deliveries(campaign_id)
-- WHERE status = 'pending'.
-- The cancel-campaign path flips all pending deliveries to 'skipped'; this
-- partial index makes that update O(M pending rows) rather than O(N full scan).
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_newsletter_deliveries_pending
    ON newsletter_campaign_deliveries (campaign_id)
    WHERE status = 'pending';
