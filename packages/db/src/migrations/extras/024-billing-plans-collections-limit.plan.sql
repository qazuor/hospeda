-- =============================================================================
-- 024-billing-plans-collections-limit.plan.sql
--
-- Purpose (SPEC-287 — Favorites Collections, Per-Plan Limits):
--   Moves favorites collections from a global env-var cap
--   (HOSPEDA_MAX_COLLECTIONS_PER_USER, removed by T-009) to a per-plan billing
--   entitlement + limit. Seeds both facets onto every ACCOMMODATION billing
--   plan row in `billing_plans`:
--
--     can_use_collections (entitlements array) — whether the plan may use
--       favorites collections at all. tourist-free does NOT get it.
--     max_collections (limits JSONB)           — the per-plan collection cap.
--
--   Value table (matches packages/billing/src/config/plans.config.ts):
--     Plan slug (name)     entitlement            max_collections
--     ────────────────     ─────────────────────  ───────────────
--     tourist-free         (none)                 (none)
--     tourist-plus         can_use_collections     10
--     tourist-vip          can_use_collections     25
--     owner-basico         can_use_collections     25   (inherits tourist-VIP tier)
--     owner-pro            can_use_collections     25   (inherits tourist-VIP tier)
--     owner-premium        can_use_collections     25   (inherits tourist-VIP tier)
--     complex-basico       can_use_collections     25   (inherits tourist-VIP tier)
--     complex-pro          can_use_collections     25   (inherits tourist-VIP tier)
--     complex-premium      can_use_collections     25   (inherits tourist-VIP tier)
--
--   EXCLUDED: commerce-listing and partner-listing plan slugs (different
--   product_domain — same exclusion as extras/023).
--
-- OR-PRESERVE semantics (idempotent, safe for re-apply via `pnpm db:apply-extras`):
--   - The `can_use_collections` UPDATE only appends when NOT already present in
--     the entitlements array (guarded by `NOT ('can_use_collections' = ANY(entitlements))`).
--   - Every `max_collections` UPDATE is guarded with `NOT (limits ? 'max_collections')`.
--   A key already present — whether from a prior apply of this migration or a
--   manual operator edit — is NEVER overwritten. Re-running this file is always
--   a no-op (zero affected rows, no updated_at bump) once both are present.
--
-- PROD SAFETY:
--   This migration adds new keys only; it never modifies existing keys or
--   removes data. Nevertheless, take a verified `billing_plans` table backup
--   before applying in prod as a precaution. NEVER run drizzle-kit push
--   against staging/prod.
--
-- Runs via:
--   pnpm db:apply-extras                          (local dev, staging, prod)
--   hops db-migrate --target=staging|prod         (includes apply-extras)
-- =============================================================================

DO $$
DECLARE
    entitlement_rows integer := 0;
    limit_rows        integer := 0;
    rows_tmp           integer := 0;
BEGIN
    -- Guard: skip gracefully if the table is not present yet.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name   = 'billing_plans'
    ) THEN
        RAISE NOTICE '024-billing-plans-collections-limit: billing_plans table not found, skipping.';
        RETURN;
    END IF;

    -- ── can_use_collections entitlement ──────────────────────────────────────
    -- OR-PRESERVE: only append when not already present in the entitlements array.
    -- Excludes tourist-free by design (no entitlement).

    UPDATE billing_plans
    SET    entitlements = array_append(entitlements, 'can_use_collections'),
           updated_at   = NOW()
    WHERE  name IN ('tourist-plus', 'tourist-vip', 'owner-basico', 'owner-pro',
                    'owner-premium', 'complex-basico', 'complex-pro', 'complex-premium')
      AND  NOT ('can_use_collections' = ANY (entitlements));
    GET DIAGNOSTICS rows_tmp = ROW_COUNT; entitlement_rows := entitlement_rows + rows_tmp;

    -- ── max_collections limit ────────────────────────────────────────────────
    -- OR-PRESERVE: only merge the key when it is not already present in limits.

    UPDATE billing_plans
    SET    limits     = limits || jsonb_build_object('max_collections', 10),
           updated_at = NOW()
    WHERE  name = 'tourist-plus'
      AND  NOT (limits ? 'max_collections');
    GET DIAGNOSTICS rows_tmp = ROW_COUNT; limit_rows := limit_rows + rows_tmp;

    UPDATE billing_plans
    SET    limits     = limits || jsonb_build_object('max_collections', 25),
           updated_at = NOW()
    WHERE  name IN ('tourist-vip', 'owner-basico', 'owner-pro', 'owner-premium',
                    'complex-basico', 'complex-pro', 'complex-premium')
      AND  NOT (limits ? 'max_collections');
    GET DIAGNOSTICS rows_tmp = ROW_COUNT; limit_rows := limit_rows + rows_tmp;

    RAISE NOTICE '024-billing-plans-collections-limit: can_use_collections set on % row(s), max_collections set on % row(s).',
                 entitlement_rows, limit_rows;
END;
$$;
