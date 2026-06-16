-- =============================================================================
-- 016-billing-subscriptions-product-domain.column.sql
--
-- Purpose:
--   Add `product_domain varchar(32) NOT NULL DEFAULT 'accommodation'` to the
--   library-owned `billing_subscriptions` table (managed by
--   @qazuor/qzpay-drizzle). Drizzle's db:generate NEVER touches this table,
--   so the column MUST be added via the extras carril.
--
--   Default 'accommodation': existing rows are subscription-linked to
--   accommodation listings. New commerce (gastronomy, experience, etc.) rows
--   will supply 'commerce' as the domain discriminator.
--
--   An index is added on product_domain to support fast per-domain
--   subscription queries (e.g. "list all active commerce subscriptions").
--
-- Idempotency:
--   `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` is safe to re-run.
--   `CREATE INDEX IF NOT EXISTS` is safe to re-run.
--
-- Runs via:
--   pnpm db:apply-extras   (local dev, staging deploy, prod deploy)
--   hops db-migrate --target=staging|prod  (includes apply-extras)
--
-- NEVER run drizzle-kit push against staging/prod — see packages/db/CLAUDE.md.
-- =============================================================================

DO $$
BEGIN
    -- Guard: skip gracefully if billing_subscriptions does not exist yet.
    -- This can happen on a fresh DB before the QZPay migrations have run.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name   = 'billing_subscriptions'
    ) THEN
        RAISE NOTICE '016-billing-subscriptions-product-domain: billing_subscriptions not found, skipping.';
        RETURN;
    END IF;

    -- Add the column if it is not already present.
    ALTER TABLE billing_subscriptions
        ADD COLUMN IF NOT EXISTS product_domain varchar(32) NOT NULL DEFAULT 'accommodation';

    RAISE NOTICE '016-billing-subscriptions-product-domain: product_domain column ensured.';
END;
$$;

-- Index on product_domain for per-domain subscription queries.
-- CREATE INDEX IF NOT EXISTS is idempotent (safe to re-apply).
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_product_domain
    ON billing_subscriptions (product_domain);
