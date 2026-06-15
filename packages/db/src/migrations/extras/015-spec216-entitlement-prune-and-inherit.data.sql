-- 015-spec216-entitlement-prune-and-inherit.data.sql
--
-- SPEC-216 — Owner plans inherit tourist entitlements (owner = superset of
-- tourist) + prune of 8 undeliverable entitlements.
--
-- This is a DATA migration (no schema change), so it lives in the extras carril
-- and is re-applied on every `db:apply-extras`. It is IDEMPOTENT: every step is
-- a set operation or a key-list delete, so re-running converges to the same
-- state. It is also DATA-DRIVEN — the tourist-VIP entitlement set is read from
-- the live `tourist-vip` plan row rather than hard-coded, so it can never drift
-- from `@repo/billing` config.
--
-- Why a migration and not just a re-seed:
--   * The billing ENTITLEMENTS seeder is insert-only — it can add the current
--     catalog but never DELETE the 8 keys that SPEC-216 removed from config.
--   * The full `--required` seed is not incrementally runnable against a live
--     DB (it fails on the already-seeded users step before reaching billing),
--     so the staging change cannot go through the seeder.
-- Fresh prod is seeded normally; this migration is a no-op there once seeded.
--
-- The 8 pruned keys (user-approved 2026-06-11, SPEC-216 Part 0 audit):
--   airport_transfers, concierge_service, white_label,
--   multi_channel_integration, social_media_integration, early_access_events,
--   dedicated_manager, api_access

BEGIN;

-- Owner & complex plans become a superset of tourist-VIP:
--   new entitlements = (own entitlements ∪ tourist-VIP) minus the pruned keys.
UPDATE billing_plans p
SET entitlements = COALESCE((
    SELECT array_agg(DISTINCT e ORDER BY e)
    FROM (
        SELECT unnest(p.entitlements) AS e
        UNION
        SELECT unnest(tv.entitlements)
        FROM billing_plans tv
        WHERE tv.name = 'tourist-vip'
    ) u
    WHERE e <> ALL (ARRAY[
        'airport_transfers', 'concierge_service', 'white_label',
        'multi_channel_integration', 'social_media_integration',
        'early_access_events', 'dedicated_manager', 'api_access'
    ]::text[])
), ARRAY[]::text[])
WHERE p.name LIKE 'owner-%' OR p.name LIKE 'complex-%';

-- Tourist plans only drop the pruned keys (they gain nothing):
--   new entitlements = own entitlements minus the pruned keys.
UPDATE billing_plans p
SET entitlements = COALESCE((
    SELECT array_agg(DISTINCT e ORDER BY e)
    FROM unnest(p.entitlements) AS e
    WHERE e <> ALL (ARRAY[
        'airport_transfers', 'concierge_service', 'white_label',
        'multi_channel_integration', 'social_media_integration',
        'early_access_events', 'dedicated_manager', 'api_access'
    ]::text[])
), ARRAY[]::text[])
WHERE p.name LIKE 'tourist-%';

-- Catalog: drop the pruned entitlement definitions (insert-only seeder cannot).
DELETE FROM billing_entitlements
WHERE key = ANY (ARRAY[
    'airport_transfers', 'concierge_service', 'white_label',
    'multi_channel_integration', 'social_media_integration',
    'early_access_events', 'dedicated_manager', 'api_access'
]::text[]);

-- Per-customer grants of the pruned keys are now orphaned (the column has no FK
-- to billing_entitlements, and gating resolves from the plan at runtime). Drop
-- them so customer-entitlement rows stay consistent with the catalog.
DELETE FROM billing_customer_entitlements
WHERE entitlement_key = ANY (ARRAY[
    'airport_transfers', 'concierge_service', 'white_label',
    'multi_channel_integration', 'social_media_integration',
    'early_access_events', 'dedicated_manager', 'api_access'
]::text[]);

COMMIT;
