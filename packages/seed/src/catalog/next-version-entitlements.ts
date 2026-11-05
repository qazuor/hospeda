/**
 * Entitlement-only catalog publications that come AFTER the immutable V2.4b
 * baseline (migrations 0144/0176). Each entry is published as a NEW plan version
 * by a `contentOnly` seed data-migration; the baseline is never edited, because
 * GUARD:G18 (`scripts/check-catalog-sql.ts`) compares the baseline with the SQL
 * migrations wrote and a published version must not change.
 *
 * Single source: migration 0133 reads this list, and the production catalog
 * source (`scripts/production-catalog/catalog.ts`) re-exports it. It lives in the
 * seed package because seed must not depend on the root `scripts/` directory.
 */
export const PRODUCTION_PLAN_NEXT_VERSION_ENTITLEMENTS = [
    { vertical: 'accommodation', slug: 'owner-basico', key: 'can_embed_video' }
] as const;

/** One entitlement grant published as part of a next plan version. */
export type NextVersionEntitlement = (typeof PRODUCTION_PLAN_NEXT_VERSION_ENTITLEMENTS)[number];
