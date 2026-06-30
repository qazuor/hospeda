-- =============================================================================
-- 023-billing-plans-ai-consumer-search-limits.plan.sql
--
-- Purpose (SPEC-283 — Graduated AI Usage Limits per Plan):
--   Seeds two new AI consumer-facing limit keys onto every ACCOMMODATION
--   billing plan row in `billing_plans`:
--
--     max_ai_search_per_month         — maximum AI-powered accommodation
--                                       search queries a consumer may issue
--                                       per calendar month.
--     max_ai_chat_consumer_per_month  — maximum AI chat turns a consumer
--                                       (tourist browsing listings) may
--                                       initiate per calendar month.
--
--   Value table (owner confirmed OQ-3):
--     Plan slug (name)               search  consumer
--     ─────────────────────────────  ──────  ────────
--     tourist-free                       10        10
--     tourist-plus                       50        50
--     tourist-vip                       200       200
--     owner-basico                      200       200
--     owner-pro                         200       200
--     owner-premium                     200       200
--     complex-basico                    200       200
--     complex-pro                       200       200
--     complex-premium                   200       200
--
--   Numeric values are COMMERCIAL-LAYER defaults. Operators may edit these
--   in `billing_plans.limits` directly at any time; this migration only seeds
--   the initial defaults and never re-seeds a value already present in the
--   JSONB object. No -1 (UNLIMITED) sentinels are used — see SPEC-211 §6.1
--   guardrail (cost-hole prevention).
--
--   EXCLUDED: commerce-listing and partner-listing plan slugs. These rows
--   belong to a different product_domain; accommodation consumer limits do not
--   apply to them. Only the 9 accommodation slugs above are targeted.
--
-- OR-PRESERVE semantics (idempotent, safe for re-apply via `pnpm db:apply-extras`):
--   Every UPDATE is guarded with `NOT (limits ? '<key>')`. A key already present
--   in the JSONB object — whether from a prior apply of this migration or from a
--   manual operator edit — is NEVER overwritten. Re-running this file is always a
--   no-op (zero affected rows, no updated_at bump) once the keys are present.
--
-- PROD SAFETY:
--   This migration adds new keys only; it never modifies existing keys or removes
--   data. Nevertheless, take a verified `billing_plans` table backup before
--   applying in prod as a precaution. NEVER run drizzle-kit push against
--   staging/prod.
--
-- Runs via:
--   pnpm db:apply-extras                          (local dev, staging, prod)
--   hops db-migrate --target=staging|prod         (includes apply-extras)
-- =============================================================================

DO $$
DECLARE
    search_rows   integer := 0;
    consumer_rows integer := 0;
    rows_tmp      integer := 0;
BEGIN
    -- Guard: skip gracefully if the table is not present yet.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name   = 'billing_plans'
    ) THEN
        RAISE NOTICE '023-billing-plans-ai-consumer-search-limits: billing_plans table not found, skipping.';
        RETURN;
    END IF;

    -- ── max_ai_search_per_month ──────────────────────────────────────────────
    -- OR-PRESERVE: only merge the key when it is not already present in limits.

    UPDATE billing_plans
    SET    limits     = limits || jsonb_build_object('max_ai_search_per_month', 10),
           updated_at = NOW()
    WHERE  name = 'tourist-free'
      AND  NOT (limits ? 'max_ai_search_per_month');
    GET DIAGNOSTICS rows_tmp = ROW_COUNT; search_rows := search_rows + rows_tmp;

    UPDATE billing_plans
    SET    limits     = limits || jsonb_build_object('max_ai_search_per_month', 50),
           updated_at = NOW()
    WHERE  name = 'tourist-plus'
      AND  NOT (limits ? 'max_ai_search_per_month');
    GET DIAGNOSTICS rows_tmp = ROW_COUNT; search_rows := search_rows + rows_tmp;

    UPDATE billing_plans
    SET    limits     = limits || jsonb_build_object('max_ai_search_per_month', 200),
           updated_at = NOW()
    WHERE  name IN ('tourist-vip', 'owner-basico', 'owner-pro', 'owner-premium',
                    'complex-basico', 'complex-pro', 'complex-premium')
      AND  NOT (limits ? 'max_ai_search_per_month');
    GET DIAGNOSTICS rows_tmp = ROW_COUNT; search_rows := search_rows + rows_tmp;

    -- ── max_ai_chat_consumer_per_month ────────────────────────────────────────
    -- OR-PRESERVE: only merge the key when it is not already present in limits.

    UPDATE billing_plans
    SET    limits     = limits || jsonb_build_object('max_ai_chat_consumer_per_month', 10),
           updated_at = NOW()
    WHERE  name = 'tourist-free'
      AND  NOT (limits ? 'max_ai_chat_consumer_per_month');
    GET DIAGNOSTICS rows_tmp = ROW_COUNT; consumer_rows := consumer_rows + rows_tmp;

    UPDATE billing_plans
    SET    limits     = limits || jsonb_build_object('max_ai_chat_consumer_per_month', 50),
           updated_at = NOW()
    WHERE  name = 'tourist-plus'
      AND  NOT (limits ? 'max_ai_chat_consumer_per_month');
    GET DIAGNOSTICS rows_tmp = ROW_COUNT; consumer_rows := consumer_rows + rows_tmp;

    UPDATE billing_plans
    SET    limits     = limits || jsonb_build_object('max_ai_chat_consumer_per_month', 200),
           updated_at = NOW()
    WHERE  name IN ('tourist-vip', 'owner-basico', 'owner-pro', 'owner-premium',
                    'complex-basico', 'complex-pro', 'complex-premium')
      AND  NOT (limits ? 'max_ai_chat_consumer_per_month');
    GET DIAGNOSTICS rows_tmp = ROW_COUNT; consumer_rows := consumer_rows + rows_tmp;

    RAISE NOTICE '023-billing-plans-ai-consumer-search-limits: max_ai_search_per_month set on % accommodation row(s), max_ai_chat_consumer_per_month set on % accommodation row(s).',
                 search_rows, consumer_rows;
END;
$$;
