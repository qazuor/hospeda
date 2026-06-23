-- =============================================================================
-- 018-billing-promo-codes-effect-columns.column.sql
--
-- Purpose:
--   Add typed effect columns to the library-owned `billing_promo_codes` table
--   (managed by @qazuor/qzpay-drizzle). Drizzle's db:generate NEVER touches
--   this table because its schema is declared inside the external package, so
--   these columns MUST be added via the extras carril (same pattern as
--   extras/016 and extras/017 for billing_subscriptions / billing_plans).
--
--   New columns (SPEC-262 T-002, OQ-2: explicit typed columns):
--
--   effect_kind  varchar(30) NOT NULL DEFAULT 'discount'
--     Discriminator for the promo-code effect type.
--     Values: 'discount' | 'trial_extension' | 'comp'
--     DEFAULT 'discount': every existing row (all currently 'percentage'/'fixed')
--     becomes a discount effect. The per-row backfill to set the correct
--     effect_kind for config-only specials (HOSPEDA_FREE → 'comp',
--     FREEMONTH → 'trial_extension') is handled in T-003.
--
--   value_kind   varchar(20) NULL
--     Discount sub-type. Values: 'percentage' | 'fixed'.
--     NULL for non-discount effects (trial_extension, comp).
--     NOTE: The existing `value` column on billing_promo_codes carries the
--     discount amount (integer NOT NULL). The engine reads `value` + `value_kind`
--     together for 'discount' effects. For non-discount effects `value_kind` is
--     NULL and `value` has no semantic meaning. No new 'value' column is added
--     because it already exists; `value_kind` is the new discriminator.
--
--   duration_cycles  integer NULL
--     Number of billing cycles the discount applies.
--     NULL = forever (the discount re-applies on every renewal indefinitely).
--     Positive integer = applies only for the first N paid cycles.
--     NULL for 'trial_extension' and 'comp' effects (not relevant).
--
--   extra_days   integer NULL
--     Number of extra trial days for 'trial_extension' effect.
--     NULL for 'discount' and 'comp' effects.
--     Days are the canonical unit; admin form may accept months and converts
--     to days at creation time (OQ-3 decision).
--
-- Backward-compat (AC-4):
--   The DEFAULT 'discount' on effect_kind ensures every existing row reads as
--   a discount effect — no behavioral change until T-003 backfills the specials.
--   Existing inserts that do not set effect_kind will default to 'discount',
--   preserving the current one-shot discount behavior.
--
-- CHECK constraints for impossible combinations are added in T-003 (extras
-- carril, file 020-*). Drizzle cannot express CHECK constraints with SQL
-- function calls, per the project rule.
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
    -- Guard: skip gracefully if billing_promo_codes does not exist yet.
    -- This can happen on a fresh DB before the QZPay migrations have run.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name   = 'billing_promo_codes'
    ) THEN
        RAISE NOTICE '018-billing-promo-codes-effect-columns: billing_promo_codes not found, skipping.';
        RETURN;
    END IF;

    -- effect_kind: discriminator for the effect type, defaults to 'discount'
    -- so all existing rows remain backwards-compatible one-shot discounts.
    ALTER TABLE billing_promo_codes
        ADD COLUMN IF NOT EXISTS effect_kind varchar(30) NOT NULL DEFAULT 'discount';

    -- value_kind: 'percentage' | 'fixed' for discount effects; NULL otherwise.
    -- The existing `value` column carries the discount amount; this column
    -- discriminates whether it is a percentage (0-100) or a fixed amount (centavos).
    ALTER TABLE billing_promo_codes
        ADD COLUMN IF NOT EXISTS value_kind varchar(20);

    -- duration_cycles: number of billing cycles the discount applies.
    -- NULL = forever; positive integer = N cycles; NULL for non-discount effects.
    ALTER TABLE billing_promo_codes
        ADD COLUMN IF NOT EXISTS duration_cycles integer;

    -- extra_days: number of extra trial days for trial_extension effect.
    -- NULL for discount and comp effects.
    ALTER TABLE billing_promo_codes
        ADD COLUMN IF NOT EXISTS extra_days integer;

    RAISE NOTICE '018-billing-promo-codes-effect-columns: effect columns ensured on billing_promo_codes.';
END;
$$;
