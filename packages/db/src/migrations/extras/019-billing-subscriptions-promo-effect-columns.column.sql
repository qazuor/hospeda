-- =============================================================================
-- 019-billing-subscriptions-promo-effect-columns.column.sql
--
-- Purpose:
--   Add promo-effect tracking column to the library-owned
--   `billing_subscriptions` table (managed by @qazuor/qzpay-drizzle).
--   Drizzle's db:generate NEVER touches this table because its schema is
--   declared inside the external package, so this column MUST be added via
--   the extras carril (same pattern as extras/016 for product_domain).
--
--   New column (SPEC-262 T-002):
--
--   promo_effect_remaining_cycles  integer NULL
--     Countdown for multi-cycle discount effects.
--     NULL when: no promo effect active, or the discount applies forever
--     (duration_cycles = NULL on the promo code), or the effect kind is
--     not 'discount'.
--     Positive integer: number of billing cycles remaining where the discount
--     still applies. Decremented by the renewal engine after each confirmed
--     charge. When it reaches 0 the effect is exhausted and full price is
--     charged from the next cycle onward.
--
--   This column is read and written by the renewal engine (T-005/T-006) on
--   every `subscription_authorized_payment.created` webhook event. The
--   renewal cron MUST check this value before computing the charge amount.
--
-- Idempotency:
--   `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` is safe to re-run.
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
        RAISE NOTICE '019-billing-subscriptions-promo-effect-columns: billing_subscriptions not found, skipping.';
        RETURN;
    END IF;

    -- promo_effect_remaining_cycles: countdown for multi-cycle discount effects.
    -- NULL when no active discount effect or effect applies forever.
    ALTER TABLE billing_subscriptions
        ADD COLUMN IF NOT EXISTS promo_effect_remaining_cycles integer;

    RAISE NOTICE '019-billing-subscriptions-promo-effect-columns: promo_effect_remaining_cycles column ensured on billing_subscriptions.';
END;
$$;
