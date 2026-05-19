-- =============================================================================
-- 0023_newsletter_delivery_constraints.sql
--
-- SPEC-101: Constraints for newsletter_campaign_deliveries that Drizzle ORM
-- cannot express inline.
--
-- 1. UNIQUE (campaign_id, subscriber_id, channel)
--    Guards idempotency. A double-click on the admin "Send" button or a
--    QStash-style retry must not produce duplicate delivery rows.
--
-- 2. Partial BTREE on (campaign_id) WHERE status = 'pending'
--    The cancel-campaign service path flips all pending deliveries to
--    'skipped' for a given campaign. A partial index makes that update
--    O(M) where M = pending rows, instead of O(N) full table scan.
--
-- Idempotent: both indexes use IF NOT EXISTS.
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_newsletter_deliveries_campaign_subscriber_channel
    ON newsletter_campaign_deliveries (campaign_id, subscriber_id, channel);

CREATE INDEX IF NOT EXISTS idx_newsletter_deliveries_pending
    ON newsletter_campaign_deliveries (campaign_id)
    WHERE status = 'pending';
