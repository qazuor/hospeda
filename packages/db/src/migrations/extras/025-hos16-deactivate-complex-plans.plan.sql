-- =============================================================================
-- 025-hos16-deactivate-complex-plans.plan.sql
--
-- Purpose (HOS-16 — Plan Packaging Recalibration):
--   The complex/multi-property vertical is not implemented yet, but its 3
--   plans (complex-basico, complex-pro, complex-premium) were active and
--   partly exposed anyway. This migration deactivates them on existing
--   environments so `GET /api/v1/public/plans` (which filters on
--   `active = true`) stops advertising a product that can't be sold.
--
--   `active` is classified 'commercial' in Model C
--   (packages/billing/src/config/model-c-field-split.ts) — the seeder never
--   overwrites it once a row exists, so the config-level `isActive: false`
--   flip in packages/billing/src/config/plans.config.ts does NOT propagate
--   to already-seeded rows on staging/prod. This one-off UPDATE is the
--   explicit, auditable way to apply it there. Fresh environments get the
--   correct `active = false` directly from the seeder on first insert.
--
--   Reversible: re-activate any of these 3 plans at any time with a manual
--   `UPDATE billing_plans SET active = true WHERE name = '<slug>'` once the
--   complex vertical ships (tracked separately, not part of HOS-16).
--
-- Dry-run first (run this SELECT manually before applying, expect 3 rows,
-- all with active = true going in):
--   SELECT name, active FROM billing_plans
--   WHERE name IN ('complex-basico', 'complex-pro', 'complex-premium');
--
-- OR-PRESERVE semantics (idempotent, safe for re-apply via `pnpm db:apply-extras`):
--   The UPDATE is scoped to `WHERE active = true`, so re-running this file
--   after the first successful apply is a no-op (zero affected rows, no
--   updated_at bump). It also never touches a row an operator has already
--   manually re-activated to `true` again after this migration — no, wait:
--   it WOULD re-deactivate a manual re-activation, since re-apply always
--   re-scans `active = true`. That is intentional: this migration's guard is
--   "only 3 named plans, never active", not "never touched again" — if an
--   operator wants to keep one of these 3 permanently active, remove its
--   name from this file's WHERE clause in a follow-up, don't rely on
--   idempotency alone to protect a manual override.
--
-- PROD SAFETY:
--   This migration only flips a boolean flag on 3 rows; it never deletes or
--   restructures data. Run the dry-run SELECT above first to confirm exactly
--   3 rows are affected before applying in prod.
--
-- Runs via:
--   pnpm db:apply-extras                          (local dev, staging, prod)
--   hops db-migrate --target=staging|prod         (includes apply-extras)
-- =============================================================================

DO $$
DECLARE
    deactivated_rows integer := 0;
BEGIN
    -- Guard: skip gracefully if the table is not present yet.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name   = 'billing_plans'
    ) THEN
        RAISE NOTICE '025-hos16-deactivate-complex-plans: billing_plans table not found, skipping.';
        RETURN;
    END IF;

    UPDATE billing_plans
    SET    active     = false,
           updated_at = NOW()
    WHERE  name IN ('complex-basico', 'complex-pro', 'complex-premium')
      AND  active = true;
    GET DIAGNOSTICS deactivated_rows = ROW_COUNT;

    RAISE NOTICE '025-hos16-deactivate-complex-plans: deactivated % complex plan row(s).',
                 deactivated_rows;
END;
$$;
