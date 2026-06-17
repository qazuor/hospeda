-- =============================================================================
-- 017-billing-plans-product-domain.column.sql
--
-- Purpose:
--   Add `product_domain varchar(32) NOT NULL DEFAULT 'accommodation'` to the
--   library-owned `billing_plans` table (managed by @qazuor/qzpay-drizzle).
--   Drizzle's db:generate NEVER touches this table, so the column MUST be added
--   via the extras carril (same situation as billing_subscriptions.product_domain
--   in migration 016).
--
--   Default 'accommodation': every existing plan row is an accommodation-tier
--   plan (owner / complex / tourist). The commerce plan (SPEC-239 T-049) is
--   seeded with product_domain='commerce' so the public plans endpoint and the
--   web pricing pages EXCLUDE it from the accommodation-facing plan lists.
--
--   An index is added on product_domain to support fast per-domain plan
--   queries (e.g. "exclude all commerce plans from the public list").
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
    -- Guard: skip gracefully if billing_plans does not exist yet.
    -- This can happen on a fresh DB before the QZPay migrations have run.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name   = 'billing_plans'
    ) THEN
        RAISE NOTICE '017-billing-plans-product-domain: billing_plans not found, skipping.';
        RETURN;
    END IF;

    -- Add the column if it is not already present.
    ALTER TABLE billing_plans
        ADD COLUMN IF NOT EXISTS product_domain varchar(32) NOT NULL DEFAULT 'accommodation';

    RAISE NOTICE '017-billing-plans-product-domain: product_domain column ensured.';
END;
$$;

-- Index on product_domain for per-domain plan queries.
-- CREATE INDEX IF NOT EXISTS is idempotent (safe to re-apply).
CREATE INDEX IF NOT EXISTS idx_billing_plans_product_domain
    ON billing_plans (product_domain);
