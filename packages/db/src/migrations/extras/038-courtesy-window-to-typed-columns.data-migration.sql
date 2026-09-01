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
