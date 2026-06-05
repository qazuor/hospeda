-- =============================================================================
-- 010-abandoned-status.data-migration.sql
--
-- Purpose:
--   Canonicalise the `abandoned` subscription status vocabulary.
--   Before SPEC-194 T-003, the abandoned-pending-subs cron wrote the
--   qzpay-vocabulary value `incomplete_expired` to billing_subscriptions.status.
--   The canonical Hospeda enum value is `abandoned`. This migration folds all
--   legacy rows into the canonical value so that direct DB queries for
--   status = 'abandoned' return all abandoned rows.
--
-- Idempotency:
--   The UPDATE is a no-op when no `incomplete_expired` rows remain, so this
--   file is safe to re-apply by `pnpm db:apply-extras` on every deploy.
--
-- Runs via:
--   pnpm db:apply-extras   (local dev, staging deploy, prod deploy)
--
-- NEVER run drizzle-kit push against staging/prod — see packages/db/CLAUDE.md.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'billing_subscriptions'
  ) THEN
    RAISE NOTICE 'Table billing_subscriptions does not exist, skipping 010-abandoned-status migration.';
    RETURN;
  END IF;

  UPDATE billing_subscriptions
  SET    status     = 'abandoned',
         updated_at = NOW()
  WHERE  status = 'incomplete_expired';

  RAISE NOTICE '010-abandoned-status: migrated % row(s) from incomplete_expired to abandoned.',
               ROW_COUNT();
END;
$$;
