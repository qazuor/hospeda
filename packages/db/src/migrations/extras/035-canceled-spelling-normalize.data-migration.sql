-- =============================================================================
-- 035-canceled-spelling-normalize.data-migration.sql
--
-- Purpose:
--   Canonicalise the `cancelled` subscription status spelling (H-147).
--   qzpay-core final-writes the American spelling `canceled` (1 L) when a
--   subscription is cancelled through its own cancel path (admin panel,
--   dunning), while Hospeda's canonical enum value — and everything Hospeda
--   itself writes — is the British `cancelled` (2 L's). The column therefore
--   accumulated both spellings for the same state.
--
--   The consequence is not cosmetic. Any reader that asks the column for
--   `'cancelled'` is blind to the rows qzpay wrote: at the time of writing,
--   production held 6 rows on the 1-L spelling against 2 on the 2-L one, and
--   the addon-expiry cron filters with `status = 'cancelled'` in two places.
--   The state machine's own guard was likewise rejecting those rows as an
--   unknown source status, which is what surfaced the bug (a refund WARN with
--   from=canceled to=cancelled).
--
--   The companion code fix normalises the status on READ, so transitions work
--   regardless of which spelling a row carries. This migration is what fixes
--   the direct SQL readers, which no amount of read-side normalisation reaches.
--
-- Scope:
--   Deliberately narrow — only the `canceled` → `cancelled` fold. The other
--   qzpay-vocabulary values are not touched here: `incomplete_expired` was
--   already folded by `010-abandoned-status`, and `incomplete` / `unpaid` are
--   creation-time states with no rows in any environment. Widening this file
--   would move rows between lifecycle states, which is a different decision.
--
-- Soft-deleted rows are included on purpose. A restored subscription must not
-- come back carrying the spelling this migration exists to eliminate. The
-- notice reports live and deleted counts separately so an operator can see
-- exactly what moved.
--
-- Idempotency:
--   The UPDATE is a no-op once no `canceled` rows remain, so this file is safe
--   to re-apply by `pnpm db:apply-extras` on every deploy.
--
-- Runs via:
--   pnpm db:apply-extras   (local dev, staging deploy, prod deploy)
--
-- NEVER run drizzle-kit push against staging/prod — see packages/db/CLAUDE.md.
-- =============================================================================

DO $$
DECLARE
  live_rows    integer;
  deleted_rows integer;
  moved_rows   integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'billing_subscriptions'
  ) THEN
    RAISE NOTICE 'Table billing_subscriptions does not exist, skipping 035-canceled-spelling-normalize migration.';
    RETURN;
  END IF;

  SELECT count(*) FILTER (WHERE deleted_at IS NULL),
         count(*) FILTER (WHERE deleted_at IS NOT NULL)
    INTO live_rows, deleted_rows
    FROM billing_subscriptions
   WHERE status = 'canceled';

  UPDATE billing_subscriptions
  SET    status     = 'cancelled',
         updated_at = NOW()
  WHERE  status = 'canceled';

  GET DIAGNOSTICS moved_rows = ROW_COUNT;
  RAISE NOTICE '035-canceled-spelling-normalize: folded % row(s) from canceled to cancelled (% live, % soft-deleted).',
               moved_rows, live_rows, deleted_rows;
END;
$$;
