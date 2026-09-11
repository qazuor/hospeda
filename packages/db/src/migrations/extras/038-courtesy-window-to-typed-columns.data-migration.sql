-- =============================================================================
-- 038-courtesy-window-to-typed-columns.data-migration.sql
--
-- Purpose:
--   Copy every courtesy window out of `billing_subscriptions.metadata` jsonb
--   and into the typed columns `courtesy_starts_at` / `courtesy_ends_at` /
--   `courtesy_cycles_granted` (HOS-993).
--
--   The three fields were kept in `metadata` deliberately (HOS-180, spec OQ-1):
--   `billing_subscriptions` comes from `@qazuor/qzpay-drizzle`, so declaring
--   columns there meant publishing a package release, and the feature was not
--   going to wait for one. `@qazuor/qzpay-drizzle` 2.1.0 declares them, and the
--   structural carril adds them on our side; this migration moves the data.
--
-- Scope:
--   COPY ONLY. The jsonb keys are deliberately left in place — see below.
--
-- Expand/contract:
--   Deleting the source in the same release that starts reading the
--   destination leaves no way back if the copy is wrong, and this repo has
--   already paid for collapsing those two steps (HOS-433: a backfill shipped
--   beside its own DROP COLUMN read nothing, moved zero rows, and was ledgered
--   `ok` forever). So this release COPIES; a later one removes the keys, once
--   the columns have been the live source through a full courtesy cycle.
--   Until then the jsonb copy is a free rollback: reverting the code makes the
--   old reader correct again with no data restore.
--
-- Idempotency:
--   Re-running is safe and is a no-op for rows already carried across: the
--   WHERE clause only touches rows whose destination column is still NULL.
--   A row whose window was legitimately cleared after the first run is NOT
--   re-populated from the stale jsonb, because clearing also happens on the
--   code path that now writes NULL to the columns while leaving the old keys
--   behind — re-copying them would resurrect a gift that already ended.
--   That is why the guard is on `metadata->>'courtesyEndsAt'` being present
--   AND the row still being in courtesy status.
--
-- Safety:
--   `->>` yields NULL for an absent key and for a JSON null alike, and the
--   casts run only on rows that passed the NOT NULL guard, so a malformed
--   value cannot abort the statement for every other row. A cycle count that
--   is not an integer is left NULL rather than failing the migration: the
--   window's authority is the start/end pair, and the application already
--   reads a missing count as absent.
-- =============================================================================

DO $$
BEGIN
    -- =========================================================================
    -- COLUMN GUARD: the three columns arrive with @qazuor/qzpay-drizzle 2.1.0,
    -- through the structural carril (migration 0101). `db:apply-extras` runs
    -- after `db:migrate` on a live environment, so they are there by then —
    -- but this file is also re-applied against databases cloned from an older
    -- template, where they are not, and erroring there aborts the whole extras
    -- run (all 38 files) over a backfill that simply has nothing to do yet.
    --
    -- Skipping is safe precisely because the extras carril keeps no ledger:
    -- unlike a seed data-migration, this file is re-applied on every run, so
    -- the backfill happens on the first run after the columns exist. It cannot
    -- be silently marked done while having moved nothing — which is the
    -- HOS-433 failure this project already paid for.
    -- =========================================================================
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'billing_subscriptions'
          AND column_name  = 'courtesy_ends_at'
    ) THEN
        RAISE NOTICE '038-courtesy-window-to-typed-columns: courtesy columns absent (needs @qazuor/qzpay-drizzle >= 2.1.0 and migration 0101), skipping.';
        RETURN;
    END IF;

    UPDATE billing_subscriptions
    SET
        courtesy_starts_at = NULLIF(metadata ->> 'courtesyStartsAt', '')::timestamptz,
        courtesy_ends_at = NULLIF(metadata ->> 'courtesyEndsAt', '')::timestamptz,
        courtesy_cycles_granted = CASE
            WHEN metadata ->> 'courtesyCyclesGranted' ~ '^[0-9]+$'
                THEN (metadata ->> 'courtesyCyclesGranted')::integer
            ELSE NULL
        END
    WHERE
        courtesy_ends_at IS NULL
        AND metadata ->> 'courtesyEndsAt' IS NOT NULL
        AND status = 'courtesy';
END $$;
