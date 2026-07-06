-- 028-vip-promotions-access-repair.data.sql
--
-- Repairs environments damaged by the (now-deleted) 024 rename migration.
--
-- The removed `024-vip-visibility-access-rename.data.sql` renamed the entitlement
-- key `vip_promotions_access` -> `vip_visibility_access` (SPEC-286 T-001). HOS-21
-- later re-introduced `vip_promotions_access` as a genuinely DISTINCT entitlement
-- (VIP-only exclusive deals — see the enum comment in
-- `packages/billing/src/types/entitlement.types.ts`). On any environment where the
-- old 024 already ran (e.g. staging, seeded pre-HOS-21), the catalog row for
-- `vip_promotions_access` was renamed away and every plan that should grant BOTH
-- keys ended up with only `vip_visibility_access`.
--
-- This migration converges those environments back to the config-correct state.
-- It is IDEMPOTENT and purely ADDITIVE (never renames, never deletes):
--   * 024-damaged env (staging): restores the catalog row + re-adds the key to
--     the affected plans.
--   * Correctly-seeded env (prod, fresh): both keys already present -> no-op.
--   * tourist-free / tourist-plus (never had either key): untouched.
--
-- Per `packages/billing/src/config/plans.config.ts`, VIP_VISIBILITY_ACCESS and
-- VIP_PROMOTIONS_ACCESS are always granted together via TOURIST_VIP_ENTITLEMENTS,
-- so "has visibility but not promotions" uniquely identifies 024 damage.

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Restore the vip_promotions_access catalog row if 024 renamed it away.
--    Mirrors the seed (packages/seed/src/required/billingEntitlements.seed.ts):
--    only key/name/description are set; id/created_at/updated_at use column
--    defaults. No-op when the row already exists.
-- ──────────────────────────────────────────────────────────────────────────────
INSERT INTO billing_entitlements (key, name, description)
SELECT
    'vip_promotions_access',
    'VIP promotions access',
    'Access to VIP-only tier exclusive deals, in addition to the plus tier'
WHERE NOT EXISTS (
    SELECT 1 FROM billing_entitlements WHERE key = 'vip_promotions_access'
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Re-add vip_promotions_access to any plan the 024 rename collapsed into
--    vip_visibility_access. Precisely targets 024 damage: a plan that has
--    vip_visibility_access but lost vip_promotions_access. No-op on correctly
--    seeded envs (both present) and on plans that never had either key.
-- ──────────────────────────────────────────────────────────────────────────────
UPDATE billing_plans
SET entitlements = entitlements || ARRAY['vip_promotions_access']
WHERE entitlements @> ARRAY['vip_visibility_access']
  AND NOT (entitlements @> ARRAY['vip_promotions_access']);

COMMIT;
