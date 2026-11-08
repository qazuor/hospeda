/**
 * Catalog publications that come AFTER the immutable V2.4b baseline (migrations
 * 0144/0176). Each entry is published as a NEW plan version by a `contentOnly`
 * seed data-migration; the baseline is never edited, because GUARD:G18
 * (`scripts/check-catalog-sql.ts`) compares the baseline with the SQL migrations
 * wrote and a published version must not change.
 *
 * Single source: each migration reads its own list here, and the production
 * catalog source (`scripts/production-catalog/catalog.ts`) re-exports them. It
 * lives in the seed package because seed must not depend on the root `scripts/`
 * directory.
 *
 * One list per migration on purpose: a migration that already ran in a live
 * environment still runs for real on a fresh database (`contentOnly`), so adding
 * an entry to an existing list would make the OLD migration publish it too.
 */
export const PRODUCTION_PLAN_NEXT_VERSION_ENTITLEMENTS = [
    { vertical: 'accommodation', slug: 'owner-basico', key: 'can_embed_video' }
] as const;

/** One entitlement grant published as part of a next plan version (HOS-2037, migration 0133). */
export type NextVersionEntitlement = (typeof PRODUCTION_PLAN_NEXT_VERSION_ENTITLEMENTS)[number];

/**
 * HOS-2077 (owner decision, 2026-11-08): AI chat on the venue and experience
 * Basic (20/month) and Pro (100/month) plans. Read by migration 0156.
 *
 * Each entry adds one metered entitlement row and raises one limit row of the
 * plan's current version; the row's `planQuota` equals the limit. `trialQuota`
 * follows the catalog convention for a metered owner entitlement: it is the
 * quota the trial gets, which the trial takes from the LOWEST-rank sellable plan
 * (Basic), so it is the Basic quota on every rank (accommodation: 50 on Basic,
 * Pro and Premium). The trial resolution (`trial-ratchet.ts`) never reads it, it
 * reads the Basic limit row; the column is still required together with
 * `planQuota` (`ck_plan_version_entitlement_quotas_together`).
 */
export const PRODUCTION_PLAN_NEXT_VERSION_QUOTA_GRANTS = [
    {
        vertical: 'venue',
        slug: 'venue-basico',
        entitlement: { key: 'ai_chat', planQuota: 20, trialQuota: 20 },
        limit: { key: 'max_ai_chat_venue_per_month', value: 20 }
    },
    {
        vertical: 'venue',
        slug: 'venue-pro',
        entitlement: { key: 'ai_chat', planQuota: 100, trialQuota: 20 },
        limit: { key: 'max_ai_chat_venue_per_month', value: 100 }
    },
    {
        vertical: 'experience',
        slug: 'experience-basico',
        entitlement: { key: 'ai_chat', planQuota: 20, trialQuota: 20 },
        limit: { key: 'max_ai_chat_experience_per_month', value: 20 }
    },
    {
        vertical: 'experience',
        slug: 'experience-pro',
        entitlement: { key: 'ai_chat', planQuota: 100, trialQuota: 20 },
        limit: { key: 'max_ai_chat_experience_per_month', value: 100 }
    }
] as const;

/** One metered entitlement plus the limit it raises, published as a next plan version. */
export type NextVersionQuotaGrant = (typeof PRODUCTION_PLAN_NEXT_VERSION_QUOTA_GRANTS)[number];
