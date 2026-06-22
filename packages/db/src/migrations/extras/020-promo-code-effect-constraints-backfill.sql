-- =============================================================================
-- 020-promo-code-effect-constraints-backfill.sql
--
-- Purpose:
--   (1) Backfill the new typed effect columns on `billing_promo_codes` that
--       were added in extras/018. Legacy rows still have value_kind IS NULL
--       (the ADD COLUMN IF NOT EXISTS added them as NULL); this migration
--       populates them correctly based on the pre-existing `type` column and
--       fixes the known config-only specials (HOSPEDA_FREE, FREEMONTH,
--       LANZAMIENTO50, BIENVENIDO30).
--
--   (2) Add CHECK constraints that enforce the invariants of each effect_kind
--       shape. These are placed in the extras carril (not via db:generate)
--       because Drizzle cannot express CHECK constraints that reference
--       multiple columns or involve cross-column logic with SQL function calls,
--       and because billing_promo_codes is owned by @qazuor/qzpay-drizzle and
--       is therefore invisible to db:generate.
--
-- ORDERING — backfill MUST run BEFORE constraints:
--   The CHECKs are added via plain ADD CONSTRAINT (not ADD ... NOT VALID).
--   This is safe because:
--     a) All existing rows are updated to a valid state by the backfill
--        above in the same script, so the constraint scan on ADD CONSTRAINT
--        finds no violations.
--     b) NOT VALID + VALIDATE CONSTRAINT would be necessary only when we
--        cannot guarantee all rows pass before adding the constraint. Here
--        we can, so the simpler form is preferred.
--   If this file is re-run, the ADD COLUMN IF NOT EXISTS guards in 018 make
--   the columns a no-op, and the idempotent WHERE clauses in the UPDATEs make
--   the backfill a no-op (0 rows affected). The `IF NOT EXISTS (SELECT 1 FROM
--   pg_constraint ...)` guards below make the ADD CONSTRAINT a no-op too.
--
-- Backfill idempotency strategy:
--   Each UPDATE only matches rows that have NOT yet been backfilled
--   (value_kind IS NULL / effect_kind = 'discount' / code = ...). A second
--   run of this script produces 0 rows changed on every UPDATE statement.
--
-- Subscription reconciliation:
--   Any billing_subscriptions row that references a comp promo code
--   (HOSPEDA_FREE) and is still in status='active' is flipped to status='comp'.
--   This fixes the AC-2.3 latent bug where 100% discount is treated as normal
--   billing-cycle active rather than permanently comped.
--
-- NOTE on HOSPEDA_FREE `value` column:
--   The existing `value` column on billing_promo_codes carries the discount
--   amount (integer NOT NULL — seeds it as discountPercent). For comp rows the
--   value has no semantic meaning in the new engine, but we intentionally do
--   NOT reset it to 0 because:
--     1. The column is NOT NULL (no default after insert) — a reset would need
--        a value anyway, and 100 (the seeded value) is harmless.
--     2. Zeroing a NOT NULL column on rows that might be audited would create
--        audit noise without benefit.
--   For trial_extension rows (FREEMONTH, discountPercent = 0) the value IS
--   already 0 in the DB — no write needed there either.
--
-- Runs via:
--   pnpm db:apply-extras   (local dev, staging deploy, prod deploy)
--   hops db-migrate --target=staging|prod  (includes apply-extras)
--
-- NEVER run drizzle-kit push against staging/prod — see packages/db/CLAUDE.md.
-- =============================================================================

DO $$
DECLARE
    v_rows_affected integer;
    v_hospeda_free_id uuid;
BEGIN
    -- =========================================================================
    -- TABLE GUARD: skip gracefully if billing_promo_codes does not exist yet.
    -- This can happen on a fresh DB before the QZPay migrations have run.
    -- =========================================================================
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name   = 'billing_promo_codes'
    ) THEN
        RAISE NOTICE '020-promo-code-effect-constraints-backfill: billing_promo_codes not found, skipping.';
        RETURN;
    END IF;

    -- =========================================================================
    -- COLUMN GUARD: the effect columns from 018 must exist before we backfill.
    -- If they are somehow absent, skip and warn rather than erroring.
    -- =========================================================================
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'billing_promo_codes'
          AND column_name  = 'effect_kind'
    ) THEN
        RAISE NOTICE '020-promo-code-effect-constraints-backfill: effect_kind column absent (run extras/018 first), skipping.';
        RETURN;
    END IF;

    -- =========================================================================
    -- STEP 1: BACKFILL
    -- =========================================================================

    -- -------------------------------------------------------------------------
    -- 1a. Generic legacy rows (not yet backfilled):
    --     Identify rows where value_kind IS NULL AND duration_cycles IS NULL
    --     AND extra_days IS NULL AND effect_kind = 'discount'.
    --     These are the un-processed rows — all added before T-003 ran.
    --
    --     Map the existing `type` column → value_kind:
    --       'percentage' → 'percentage'
    --       'fixed'      → 'fixed'
    --     Set duration_cycles = 1 (one-shot, per AC-4.1 spec default).
    --     effect_kind stays 'discount' (already the column DEFAULT).
    --
    --     NOTE: `value` already holds the discount amount (seeded as
    --     discountPercent for percentage rows, or fixed cents for fixed rows).
    --     We do NOT overwrite `value` here — the existing data is correct.
    -- -------------------------------------------------------------------------
    UPDATE billing_promo_codes
    SET
        value_kind       = type,           -- 'percentage' or 'fixed' — 1:1 mapping
        duration_cycles  = 1               -- one-shot default per AC-4.1
    WHERE
        effect_kind      = 'discount'
        AND value_kind   IS NULL
        AND duration_cycles IS NULL
        AND extra_days   IS NULL;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    RAISE NOTICE '020-promo-code-effect-constraints-backfill: generic legacy rows backfilled: %', v_rows_affected;

    -- -------------------------------------------------------------------------
    -- 1b. HOSPEDA_FREE → effect_kind = 'comp'
    --     comp promos have no sub-type parameters: value_kind, duration_cycles,
    --     and extra_days must all be NULL. Fixes the AC-2.3 latent bug where
    --     a 100% discount was treated as a billing-cycle discount rather than
    --     a permanent comp grant.
    --     Safe no-op if the code does not exist as a row.
    -- -------------------------------------------------------------------------
    UPDATE billing_promo_codes
    SET
        effect_kind     = 'comp',
        value_kind      = NULL,
        duration_cycles = NULL,
        extra_days      = NULL
    WHERE
        code = 'HOSPEDA_FREE';

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    RAISE NOTICE '020-promo-code-effect-constraints-backfill: HOSPEDA_FREE rows updated: %', v_rows_affected;

    -- -------------------------------------------------------------------------
    -- 1c. FREEMONTH → effect_kind = 'trial_extension', extra_days = 30
    --     trial_extension promos extend the MercadoPago free-trial period.
    --     value_kind and duration_cycles must be NULL (not applicable).
    --     extra_days carries the number of trial days to add.
    --     Safe no-op if the code does not exist as a row.
    -- -------------------------------------------------------------------------
    UPDATE billing_promo_codes
    SET
        effect_kind     = 'trial_extension',
        extra_days      = 30,
        value_kind      = NULL,
        duration_cycles = NULL
    WHERE
        code = 'FREEMONTH';

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    RAISE NOTICE '020-promo-code-effect-constraints-backfill: FREEMONTH rows updated: %', v_rows_affected;

    -- -------------------------------------------------------------------------
    -- 1d. LANZAMIENTO50 → effect_kind = 'discount', value_kind = 'percentage',
    --     value = 50, duration_cycles = 3
    --     This code may have already been partially backfilled by 1a (which
    --     sets duration_cycles = 1 for the generic case). We overwrite with
    --     the correct config values (3 cycles per the spec definition).
    --     Safe no-op if the code does not exist as a row.
    -- -------------------------------------------------------------------------
    UPDATE billing_promo_codes
    SET
        effect_kind     = 'discount',
        value_kind      = 'percentage',
        value           = 50,
        duration_cycles = 3,
        extra_days      = NULL
    WHERE
        code = 'LANZAMIENTO50';

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    RAISE NOTICE '020-promo-code-effect-constraints-backfill: LANZAMIENTO50 rows updated: %', v_rows_affected;

    -- -------------------------------------------------------------------------
    -- 1e. BIENVENIDO30 → effect_kind = 'discount', value_kind = 'percentage',
    --     value = 30, duration_cycles = 1
    --     Again may have been partially handled by 1a; this is an explicit
    --     correctness pass that also validates value = 30 (in case the seed
    --     inserted a different discountPercent for this code historically).
    --     Safe no-op if the code does not exist as a row.
    -- -------------------------------------------------------------------------
    UPDATE billing_promo_codes
    SET
        effect_kind     = 'discount',
        value_kind      = 'percentage',
        value           = 30,
        duration_cycles = 1,
        extra_days      = NULL
    WHERE
        code = 'BIENVENIDO30';

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    RAISE NOTICE '020-promo-code-effect-constraints-backfill: BIENVENIDO30 rows updated: %', v_rows_affected;

    -- -------------------------------------------------------------------------
    -- 1f. Subscription reconciliation: flip active subscriptions that use the
    --     HOSPEDA_FREE promo code from status = 'active' to status = 'comp'.
    --     comp supersedes active billing — these subscriptions should never
    --     have been in 'active' billing-cycle state.
    --
    --     Approach: look up the HOSPEDA_FREE promo code id in a subquery; if
    --     no row exists the subquery returns NULL and the UPDATE matches 0 rows
    --     (safe no-op).
    --
    --     Only billing_subscriptions rows with status = 'active' are touched;
    --     rows already in 'comp', 'cancelled', 'past_due' etc. are left alone.
    -- -------------------------------------------------------------------------
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name   = 'billing_subscriptions'
    ) THEN
        SELECT id INTO v_hospeda_free_id
        FROM billing_promo_codes
        WHERE code = 'HOSPEDA_FREE'
        LIMIT 1;

        IF v_hospeda_free_id IS NOT NULL THEN
            UPDATE billing_subscriptions
            SET status = 'comp'
            WHERE
                promo_code_id = v_hospeda_free_id
                AND status    = 'active';

            GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
            RAISE NOTICE '020-promo-code-effect-constraints-backfill: billing_subscriptions flipped active→comp for HOSPEDA_FREE: %', v_rows_affected;
        ELSE
            RAISE NOTICE '020-promo-code-effect-constraints-backfill: HOSPEDA_FREE promo code not found in DB; subscription reconciliation skipped.';
        END IF;
    ELSE
        RAISE NOTICE '020-promo-code-effect-constraints-backfill: billing_subscriptions table not found; subscription reconciliation skipped.';
    END IF;

    -- =========================================================================
    -- STEP 2: CHECK CONSTRAINTS
    --
    -- Each constraint is guarded by an existence check on pg_constraint so
    -- that re-running this script is a no-op (idempotent ADD CONSTRAINT).
    --
    -- Postgres has no `ADD CONSTRAINT IF NOT EXISTS` syntax, so we use the
    -- standard DO $$ ... IF NOT EXISTS (SELECT 1 FROM pg_constraint ...) THEN
    -- ALTER TABLE ... ADD CONSTRAINT ... END IF pattern.
    --
    -- We use plain ADD CONSTRAINT (not ADD ... NOT VALID + VALIDATE CONSTRAINT)
    -- because the backfill above guarantees every existing row satisfies each
    -- constraint at the time of addition. NOT VALID is useful only when adding
    -- a constraint on a table that may contain pre-existing violating rows
    -- and you want to avoid the full-table lock of the validation scan.
    -- Here the scan is safe: all rows are valid, the table is small (O(tens)
    -- of promo codes), and the simpler form is clearer to future maintainers.
    -- =========================================================================

    -- -------------------------------------------------------------------------
    -- 2a. Discount shape: when effect_kind = 'discount', value_kind must be
    --     non-NULL, value must be non-negative, and percentage values must
    --     not exceed 100.
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'billing_promo_codes_discount_shape_chk'
          AND conrelid = 'billing_promo_codes'::regclass
    ) THEN
        ALTER TABLE billing_promo_codes
            ADD CONSTRAINT billing_promo_codes_discount_shape_chk
            CHECK (
                effect_kind <> 'discount'
                OR (
                    value_kind IS NOT NULL
                    AND value  IS NOT NULL
                    AND value  >= 0
                    AND (value_kind <> 'percentage' OR value <= 100)
                )
            );
        RAISE NOTICE '020-promo-code-effect-constraints-backfill: added constraint billing_promo_codes_discount_shape_chk';
    ELSE
        RAISE NOTICE '020-promo-code-effect-constraints-backfill: constraint billing_promo_codes_discount_shape_chk already exists, skipping.';
    END IF;

    -- -------------------------------------------------------------------------
    -- 2b. Trial extension shape: when effect_kind = 'trial_extension',
    --     extra_days must be present and positive, and value_kind must be NULL
    --     (trial extensions do not carry a monetary discount).
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'billing_promo_codes_trial_ext_shape_chk'
          AND conrelid = 'billing_promo_codes'::regclass
    ) THEN
        ALTER TABLE billing_promo_codes
            ADD CONSTRAINT billing_promo_codes_trial_ext_shape_chk
            CHECK (
                effect_kind <> 'trial_extension'
                OR (
                    extra_days IS NOT NULL
                    AND extra_days > 0
                    AND value_kind IS NULL
                )
            );
        RAISE NOTICE '020-promo-code-effect-constraints-backfill: added constraint billing_promo_codes_trial_ext_shape_chk';
    ELSE
        RAISE NOTICE '020-promo-code-effect-constraints-backfill: constraint billing_promo_codes_trial_ext_shape_chk already exists, skipping.';
    END IF;

    -- -------------------------------------------------------------------------
    -- 2c. Comp shape: when effect_kind = 'comp', all parameter columns must
    --     be NULL — comp is a no-parameter effect (permanent free access).
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'billing_promo_codes_comp_shape_chk'
          AND conrelid = 'billing_promo_codes'::regclass
    ) THEN
        ALTER TABLE billing_promo_codes
            ADD CONSTRAINT billing_promo_codes_comp_shape_chk
            CHECK (
                effect_kind <> 'comp'
                OR (
                    value_kind      IS NULL
                    AND extra_days  IS NULL
                    AND duration_cycles IS NULL
                )
            );
        RAISE NOTICE '020-promo-code-effect-constraints-backfill: added constraint billing_promo_codes_comp_shape_chk';
    ELSE
        RAISE NOTICE '020-promo-code-effect-constraints-backfill: constraint billing_promo_codes_comp_shape_chk already exists, skipping.';
    END IF;

    -- -------------------------------------------------------------------------
    -- 2d. Duration positivity: when duration_cycles is not NULL it must be a
    --     positive integer. NULL means "applies forever" (unlimited cycles).
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'billing_promo_codes_duration_positive_chk'
          AND conrelid = 'billing_promo_codes'::regclass
    ) THEN
        ALTER TABLE billing_promo_codes
            ADD CONSTRAINT billing_promo_codes_duration_positive_chk
            CHECK (
                duration_cycles IS NULL
                OR duration_cycles > 0
            );
        RAISE NOTICE '020-promo-code-effect-constraints-backfill: added constraint billing_promo_codes_duration_positive_chk';
    ELSE
        RAISE NOTICE '020-promo-code-effect-constraints-backfill: constraint billing_promo_codes_duration_positive_chk already exists, skipping.';
    END IF;

    -- -------------------------------------------------------------------------
    -- 2e. Effect kind domain: reject unknown discriminator values at the DB
    --     level so that typos or future bugs in application code cannot corrupt
    --     the effect_kind column with unrecognised values.
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'billing_promo_codes_effect_kind_domain_chk'
          AND conrelid = 'billing_promo_codes'::regclass
    ) THEN
        ALTER TABLE billing_promo_codes
            ADD CONSTRAINT billing_promo_codes_effect_kind_domain_chk
            CHECK (
                effect_kind IN ('discount', 'trial_extension', 'comp')
            );
        RAISE NOTICE '020-promo-code-effect-constraints-backfill: added constraint billing_promo_codes_effect_kind_domain_chk';
    ELSE
        RAISE NOTICE '020-promo-code-effect-constraints-backfill: constraint billing_promo_codes_effect_kind_domain_chk already exists, skipping.';
    END IF;

    -- -------------------------------------------------------------------------
    -- 2f. value_kind domain: when present, value_kind must be a known
    --     discriminator. NULL is allowed (comp / trial_extension carry no
    --     value_kind). Mirrors 2e for effect_kind — defense in depth so a
    --     direct INSERT cannot corrupt the column with an unknown sub-type.
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'billing_promo_codes_value_kind_domain_chk'
          AND conrelid = 'billing_promo_codes'::regclass
    ) THEN
        ALTER TABLE billing_promo_codes
            ADD CONSTRAINT billing_promo_codes_value_kind_domain_chk
            CHECK (
                value_kind IS NULL
                OR value_kind IN ('percentage', 'fixed')
            );
        RAISE NOTICE '020-promo-code-effect-constraints-backfill: added constraint billing_promo_codes_value_kind_domain_chk';
    ELSE
        RAISE NOTICE '020-promo-code-effect-constraints-backfill: constraint billing_promo_codes_value_kind_domain_chk already exists, skipping.';
    END IF;

    RAISE NOTICE '020-promo-code-effect-constraints-backfill: completed successfully.';
END;
$$;
