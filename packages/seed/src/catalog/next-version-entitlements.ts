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

/**
 * HOS-2398 (owner decisions, 2026-11-20 04:29): the tourist entitlements and the
 * tourist limits come off the nine sellable owner plans. Read by migration 0188.
 *
 * Those rows only count in the owner vertical, where nobody reads them (every
 * reader of these keys passes the TOURIST vertical). What an owner gets as a
 * tourist arrives by Tourist VIP inheritance (`resolveTouristVipInheritance`),
 * which grants the Tourist VIP plan's own rows, so removing them reduces nothing.
 *
 * `ai_chat` and the owner chat limits (`max_ai_chat_per_month`, `max_ai_chat_venue_per_month`,
 * `max_ai_chat_experience_per_month`)
 * are owner capabilities with their own quota and are deliberately NOT here.
 */
export const OWNER_PLAN_REMOVED_TOURIST_ENTITLEMENT_KEYS = [
    'save_favorites',
    'write_reviews',
    'read_reviews',
    'price_alerts',
    'exclusive_deals',
    'vip_support',
    'vip_visibility_access',
    'vip_promotions_access',
    'can_compare_accommodations',
    'can_attach_review_photos',
    'can_view_search_history',
    'can_view_recommendations',
    'can_contact_whatsapp_display',
    'can_contact_whatsapp_direct',
    'can_use_collections'
] as const;

/** HOS-2398: the tourist limits removed from the owner plans together with their entitlements. */
export const OWNER_PLAN_REMOVED_TOURIST_LIMIT_KEYS = [
    'max_favorites',
    'max_active_alerts',
    'max_compare_items',
    'max_ai_search_per_month',
    'max_ai_chat_consumer_per_month',
    'max_search_history_entries',
    'max_collections'
] as const;

/** HOS-2398: the nine sellable owner plans that receive a version without the tourist keys. */
export const PRODUCTION_PLAN_NEXT_VERSION_TOURIST_KEY_REMOVALS = [
    { vertical: 'accommodation', slug: 'owner-basico' },
    { vertical: 'accommodation', slug: 'owner-pro' },
    { vertical: 'accommodation', slug: 'owner-premium' },
    { vertical: 'venue', slug: 'venue-basico' },
    { vertical: 'venue', slug: 'venue-pro' },
    { vertical: 'venue', slug: 'venue-premium' },
    { vertical: 'experience', slug: 'experience-basico' },
    { vertical: 'experience', slug: 'experience-pro' },
    { vertical: 'experience', slug: 'experience-premium' }
] as const;

/** One owner plan published without the tourist keys (HOS-2398, migration 0188). */
export type NextVersionTouristKeyRemoval =
    (typeof PRODUCTION_PLAN_NEXT_VERSION_TOURIST_KEY_REMOVALS)[number];

/**
 * HOS-2589 D-4 (owner decision, 2026-11-24): every sellable accommodation and venue
 * owner plan may publish «Solo VIP» promotions on day one. Read by data-migration
 * 0191, which grants the key to EVERY version of these plans through the bounded
 * additive-grant lane, so live subscribers (pinned to their version) receive it too.
 * Restricting it later is a catalog edit: publish a version without the key.
 */
export const PRODUCTION_PLAN_VIP_ONLY_PROMOTIONS_GRANTS = [
    { vertical: 'accommodation', slug: 'owner-basico' },
    { vertical: 'accommodation', slug: 'owner-pro' },
    { vertical: 'accommodation', slug: 'owner-premium' },
    { vertical: 'venue', slug: 'venue-basico' },
    { vertical: 'venue', slug: 'venue-pro' },
    { vertical: 'venue', slug: 'venue-premium' }
] as const;

/**
 * HOS-2589 M-4 (owner decision, 2026-11-24): how many «para todos» promotions a
 * non-VIP tourist sees in full per page. A limit row on the TOURIST floor plan, read
 * by data-migration 0191; code reads it from the effective set, never from here.
 */
export const PRODUCTION_PLAN_FREE_VISIBLE_PROMOTIONS_LIMIT = {
    vertical: 'tourist',
    slug: 'floor',
    limit: { key: 'max_free_visible_promotions', value: 3 }
} as const;

/** HOS-2495: gallery limits granted to every version of the six commercial listing plans. */
export const PRODUCTION_PLAN_LISTING_PHOTO_LIMIT_GRANTS = [
    { vertical: 'venue', slug: 'venue-basico', limit: { key: 'max_photos_per_venue', value: 15 } },
    { vertical: 'venue', slug: 'venue-pro', limit: { key: 'max_photos_per_venue', value: 30 } },
    { vertical: 'venue', slug: 'venue-premium', limit: { key: 'max_photos_per_venue', value: 50 } },
    {
        vertical: 'experience',
        slug: 'experience-basico',
        limit: { key: 'max_photos_per_experience', value: 15 }
    },
    {
        vertical: 'experience',
        slug: 'experience-pro',
        limit: { key: 'max_photos_per_experience', value: 30 }
    },
    {
        vertical: 'experience',
        slug: 'experience-premium',
        limit: { key: 'max_photos_per_experience', value: 50 }
    }
] as const;

/**
 * HOS-2184 G-6 (owner decision, 2026-11-25): every plan of the accommodation, venue
 * and experience verticals grants the AI assistant connector (MCP) on day one: the
 * three sellable plans and the pre-trial plan of each. Read by data-migration 0193,
 * which grants the global `ai_assistant_access` key to EVERY version of these plans
 * through the bounded additive-grant lane, so live subscribers (pinned to their
 * version) receive it too.
 *
 * Deliberately absent: the `floor` plans (an owner whose paid plan or trial ended
 * gets the «not included in your plan» answer), the `trial` plans (the trial derives
 * its entitlements from Premium, `trial-ratchet.ts`), and the tourist and partner
 * verticals. Restricting it later is a catalog edit: publish a version without it.
 */
export const PRODUCTION_PLAN_AI_ASSISTANT_ACCESS_GRANTS = [
    { vertical: 'accommodation', slug: 'owner-basico' },
    { vertical: 'accommodation', slug: 'owner-pro' },
    { vertical: 'accommodation', slug: 'owner-premium' },
    { vertical: 'accommodation', slug: 'pre-trial' },
    { vertical: 'venue', slug: 'venue-basico' },
    { vertical: 'venue', slug: 'venue-pro' },
    { vertical: 'venue', slug: 'venue-premium' },
    { vertical: 'venue', slug: 'pre-trial' },
    { vertical: 'experience', slug: 'experience-basico' },
    { vertical: 'experience', slug: 'experience-pro' },
    { vertical: 'experience', slug: 'experience-premium' },
    { vertical: 'experience', slug: 'pre-trial' }
] as const;

/**
 * HOS-2180 (owner decision PM-641 of 2026-11-13): the venue and experience Pro and
 * Premium plans feature listings on day one. Read by data-migration 0194, which
 * grants the global `featured_listing` key to EVERY version of these plans through
 * the bounded additive-grant lane, so live subscribers (pinned to their version)
 * receive it too.
 *
 * The accommodation plans already carry it in the 0144 baseline. Deliberately
 * absent: the trial plans, because PM-627 says TRIAL never features listings.
 * Restricting it later is a catalog edit: publish a version without the key.
 */
export const PRODUCTION_PLAN_FEATURED_LISTING_GRANTS = [
    { vertical: 'venue', slug: 'venue-pro' },
    { vertical: 'venue', slug: 'venue-premium' },
    { vertical: 'experience', slug: 'experience-pro' },
    { vertical: 'experience', slug: 'experience-premium' }
] as const;
