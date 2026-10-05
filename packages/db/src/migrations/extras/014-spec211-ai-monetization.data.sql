-- =============================================================================
-- 014-spec211-ai-monetization.data.sql
--
-- Purpose (SPEC-211 — AI Monetization Model, the single Model C sync, §7.5):
--   Bring existing `billing_plans` rows to the SPEC-211 target state in ONE
--   idempotent pass. New environments get this state from the seed
--   (plans.config.ts + billingPlans.seed.ts Model C policy); this migration is
--   the prod/existing-rows counterpart because the seed never overwrites
--   existing rows for commercial fields.
--
--   It performs three operations, all driven by the field-split in
--   packages/billing/src/config/model-c-field-split.ts:
--
--     1. Finite-limit propagation (cost guardrail, G-1). Replace the UNLIMITED
--        sentinel (-1) on the AI limit keys with the finite caps from §6.1.
--        SCOPED with `= '-1'` so a deliberate operator-set finite value is
--        NEVER clobbered. (Limit *values* are otherwise "commercial / DB wins";
--        the -1 sentinel is the single, explicit safety exception — -1 is a
--        cost hole, not a legitimate commercial value.)
--          owner-premium   : max_ai_text_improve_per_month -1 -> 1000,
--                            max_ai_chat_per_month          -1 -> 2000
--          complex-premium : max_ai_text_improve_per_month -1 -> 2000,
--                            max_ai_chat_per_month          -1 -> 5000
--        (ai_search keys are dropped in step 3, so they are not re-set here.)
--
--     2. Capability removal — ai_chat from the tourist plans (Phase 1). Drop
--        the AI_CHAT entitlement + MAX_AI_CHAT_PER_MONTH limit key from
--        tourist-free / tourist-plus / tourist-vip. ai_chat is now governed by
--        the listing owner, never the tourist.
--
--     3. Capability removal — ai_search from ALL plans (Phase 3). Drop the
--        AI_SEARCH entitlement + MAX_AI_SEARCH_PER_MONTH limit key from every
--        plan. ai_search becomes a free, platform-governed feature (rate-limit
--        + USD ceiling), not a plan entitlement.
--
--   This release introduces NO other capability deltas, so the "general
--   capability sync" of §7.5 reduces to operations 2 + 3 here. Commercial-layer
--   fields (prices, other limit values, active, description, displayName) are
--   intentionally left untouched.
--
-- Data shape (verified against 0000_baseline.sql — the COLUMN TYPES differ):
--   billing_plans.entitlements : text[]  (PostgreSQL array)        {ai_chat, ...}
--   billing_plans.limits       : jsonb OBJECT key->number          {"max_ai_chat_per_month": 20, ...}
--   Plans are matched by `name` (= the immutable slug; see packages/db/CLAUDE.md).
--   entitlements (text[]): `= ANY(col)` tests presence; `array_remove(col, v)` drops.
--   limits (jsonb): `?` tests key presence; `-` drops a key; `jsonb_set` sets a value.
--
-- Idempotency:
--   Every statement is guarded so a second run is a no-op:
--     - finite-limit UPDATEs require the value to still be the -1 sentinel;
--     - removal UPDATEs require the entitlement/limit key to still be present.
--   Safe to re-apply on every `pnpm db:apply-extras`.
--
-- Cache:
--   The in-process entitlement/limits caches (5-min TTL) are NOT cleared by this
--   SQL. A deploy restart clears them; otherwise accept up to 5 min of staleness.
--
-- PROD SAFETY:
--   Take a verified `billing_plans` table backup BEFORE applying in prod (reuse
--   the SPEC-187 manual-table-backup runbook). This mutates paying subscribers'
--   plan rows. NEVER run drizzle-kit push against staging/prod.
--
-- Runs via:
--   pnpm db:apply-extras                          (local dev, staging, prod)
--   hops db-migrate --target=staging|prod         (includes apply-extras)
-- =============================================================================

DO $$
DECLARE
    finite_rows   integer := 0;
    rows_tmp      integer := 0;
    chat_rows     integer := 0;
    search_rows   integer := 0;
BEGIN
    -- Guard: skip gracefully if the table is not present yet.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name   = 'billing_plans'
    ) THEN
        RAISE NOTICE '014-spec211-ai-monetization: billing_plans table not found, skipping.';
        RETURN;
    END IF;

    -- ── Step 1: finite-limit propagation (only where still the -1 sentinel) ──
    UPDATE billing_plans
    SET    limits     = jsonb_set(limits, '{max_ai_text_improve_per_month}', '1000'::jsonb),
           updated_at = NOW()
    WHERE  name = 'owner-premium'
      AND  limits->>'max_ai_text_improve_per_month' = '-1';
    GET DIAGNOSTICS rows_tmp = ROW_COUNT; finite_rows := finite_rows + rows_tmp;

    UPDATE billing_plans
    SET    limits     = jsonb_set(limits, '{max_ai_chat_per_month}', '2000'::jsonb),
           updated_at = NOW()
    WHERE  name = 'owner-premium'
      AND  limits->>'max_ai_chat_per_month' = '-1';
    GET DIAGNOSTICS rows_tmp = ROW_COUNT; finite_rows := finite_rows + rows_tmp;

    UPDATE billing_plans
    SET    limits     = jsonb_set(limits, '{max_ai_text_improve_per_month}', '2000'::jsonb),
           updated_at = NOW()
    WHERE  name = 'complex-premium'
      AND  limits->>'max_ai_text_improve_per_month' = '-1';
    GET DIAGNOSTICS rows_tmp = ROW_COUNT; finite_rows := finite_rows + rows_tmp;

    UPDATE billing_plans
    SET    limits     = jsonb_set(limits, '{max_ai_chat_per_month}', '5000'::jsonb),
           updated_at = NOW()
    WHERE  name = 'complex-premium'
      AND  limits->>'max_ai_chat_per_month' = '-1';
    GET DIAGNOSTICS rows_tmp = ROW_COUNT; finite_rows := finite_rows + rows_tmp;

    -- ── Step 2: remove ai_chat from the three tourist plans ─────────────────
    UPDATE billing_plans
    SET    entitlements = array_remove(entitlements, 'ai_chat'),
           limits       = limits - 'max_ai_chat_per_month',
           updated_at   = NOW()
    WHERE  name IN ('tourist-free', 'tourist-plus', 'tourist-vip')
      AND  ('ai_chat' = ANY(entitlements) OR limits ? 'max_ai_chat_per_month');
    GET DIAGNOSTICS chat_rows = ROW_COUNT;

    -- ── Step 3: remove ai_search from ALL plans ─────────────────────────────
    UPDATE billing_plans
    SET    entitlements = array_remove(entitlements, 'ai_search'),
           limits       = limits - 'max_ai_search_per_month',
           updated_at   = NOW()
    WHERE  'ai_search' = ANY(entitlements) OR limits ? 'max_ai_search_per_month';
    GET DIAGNOSTICS search_rows = ROW_COUNT;

    RAISE NOTICE '014-spec211-ai-monetization: finite-limit updates=%, ai_chat removed from % tourist row(s), ai_search removed from % row(s).',
                 finite_rows, chat_rows, search_rows;
END;
$$;
