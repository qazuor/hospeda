-- 024-vip-visibility-access-rename.data.sql
--
-- SPEC-286 T-001 (D-5) — Rename entitlement key:
--   vip_promotions_access  →  vip_visibility_access
--
-- This is a DATA migration (no schema change), so it lives in the extras carril
-- and is re-applied on every `db:apply-extras`. It is IDEMPOTENT: every UPDATE
-- uses a WHERE clause that matches only the old key, so re-running after the key
-- has already been renamed is a safe no-op.
--
-- Three tables are updated:
--   1. billing_entitlements              — catalog row (key + name)
--   2. billing_plans.entitlements        — text[] array of entitlement key strings
--   3. billing_customer_entitlements     — per-customer overrides / grants
--
-- The old key ('vip_promotions_access') was a misleading name: this entitlement
-- controls visibility (VIP tourists see RESTRICTED / owner-suspended /
-- plan-restricted accommodations), not promotions. The rename makes the purpose
-- clear without changing what the entitlement does.
--
-- Why extras and not a Drizzle migration:
--   These are data rows, not schema objects. Drizzle-generated migrations only
--   handle DDL; data-only changes belong in the extras carril.

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. billing_entitlements catalog
--    Update the key and the human-readable name. The old name was generic; the
--    new name is accurate to the actual behavior (visibility bypass for VIP
--    tourists).
-- ──────────────────────────────────────────────────────────────────────────────
UPDATE billing_entitlements
SET
    key         = 'vip_visibility_access',
    name        = 'VIP visibility access',
    description = 'VIP tourist visibility bypass: see RESTRICTED, owner-suspended, and plan-restricted accommodations',
    updated_at  = NOW()
WHERE key = 'vip_promotions_access';

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. billing_plans.entitlements  (text[] array of entitlement key strings)
--    Replace the "vip_promotions_access" element with "vip_visibility_access"
--    in-place via array_replace(). Only rows that actually contain the old key
--    are touched (the @> operator is the array-containment check).
-- ──────────────────────────────────────────────────────────────────────────────
UPDATE billing_plans
SET entitlements = array_replace(entitlements, 'vip_promotions_access', 'vip_visibility_access')
WHERE entitlements @> ARRAY['vip_promotions_access'];

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. billing_customer_entitlements  (per-customer override rows)
--    Any row granting 'vip_promotions_access' directly to a customer is renamed.
--    Safe to re-run: the WHERE clause only matches the old key; after the first
--    run the rows have already been renamed and no row matches.
-- ──────────────────────────────────────────────────────────────────────────────
UPDATE billing_customer_entitlements
SET entitlement_key = 'vip_visibility_access'
WHERE entitlement_key = 'vip_promotions_access';

COMMIT;
