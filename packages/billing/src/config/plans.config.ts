import {
    COMMERCE_TRIAL_DAYS,
    COMPLEX_TRIAL_DAYS,
    OWNER_TRIAL_DAYS,
    TOURIST_TRIAL_DAYS
} from '../constants/billing.constants.js';
import { EntitlementKey } from '../types/entitlement.types.js';
import { LimitKey, type PlanDefinition } from '../types/plan.types.js';
import { LIMIT_METADATA } from './limits.config.js';

/**
 * Helper to create a limit definition from a key and value
 */
function limit(
    key: LimitKey,
    value: number
): { key: LimitKey; value: number; name: string; description: string } {
    const meta = LIMIT_METADATA[key];
    return { key, value, name: meta.name, description: meta.description };
}

type LimitDefinition = ReturnType<typeof limit>;

/**
 * Deduplicate a list of entitlement keys, preserving first-occurrence order.
 * Used when spreading the inherited tourist-VIP set into owner/complex plans,
 * since a few keys (e.g. WhatsApp display/direct) coincide between tiers.
 */
function dedupe(keys: readonly EntitlementKey[]): EntitlementKey[] {
    return [...new Set(keys)];
}

/**
 * Merge two limit lists by key. The `override` list wins on key clash, so a
 * plan's own limit value is always authoritative over the inherited tourist-VIP
 * value. Today no limit key overlaps between the tourist and owner/complex tiers,
 * but this keeps the inheritance safe if one ever does.
 */
function mergeLimits(
    base: readonly LimitDefinition[],
    override: readonly LimitDefinition[]
): LimitDefinition[] {
    const byKey = new Map<LimitKey, LimitDefinition>();
    for (const l of base) byKey.set(l.key, l);
    for (const l of override) byKey.set(l.key, l);
    return [...byKey.values()];
}

/**
 * The full cumulative **tourist-VIP entitlement tier** — the top tourist plan's
 * entitlements. Every owner and complex plan inherits this set (SPEC-216): an
 * owner is also a full tourist, so owner plans grant the tourist-VIP features in
 * addition to their owner-specific ones. This constant is the single source of
 * truth — `TOURIST_VIP_PLAN` and the owner/complex inheritance both build from it,
 * so the tourist tier and the owner inheritance can never drift.
 */
export const TOURIST_VIP_ENTITLEMENTS: readonly EntitlementKey[] = [
    EntitlementKey.SAVE_FAVORITES,
    EntitlementKey.WRITE_REVIEWS,
    EntitlementKey.READ_REVIEWS,
    EntitlementKey.PRICE_ALERTS,
    EntitlementKey.EXCLUSIVE_DEALS,
    EntitlementKey.VIP_SUPPORT,
    EntitlementKey.VIP_VISIBILITY_ACCESS,
    EntitlementKey.VIP_PROMOTIONS_ACCESS,
    EntitlementKey.CAN_COMPARE_ACCOMMODATIONS,
    EntitlementKey.CAN_ATTACH_REVIEW_PHOTOS,
    EntitlementKey.CAN_VIEW_SEARCH_HISTORY,
    EntitlementKey.CAN_VIEW_RECOMMENDATIONS,
    EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY,
    EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT,
    EntitlementKey.CAN_USE_COLLECTIONS
];

/**
 * The cumulative **tourist-VIP limit tier**. Inherited by every owner/complex
 * plan alongside {@link TOURIST_VIP_ENTITLEMENTS}, via {@link mergeLimits}
 * (plan-specific limits stay authoritative).
 *
 * Favorites/alerts are unlimited at this tier; compare is capped at 4 items
 * (SPEC-288). The AI consumer quotas
 * (search + consumer-side chat) are the graduated top-tier value (200/month)
 * shared by tourist-VIP and every owner/complex plan as a CONSUMER
 * (SPEC-283 §5, OQ-4). They carry NO entitlement: `ai_search` is auth-baseline
 * and the consumer-side chat quota is gated by count only — having the limit
 * without the entitlement is the intended two-sided model. tourist-free/plus
 * override these with lower values.
 */
const TOURIST_VIP_LIMITS: readonly LimitDefinition[] = [
    limit(LimitKey.MAX_FAVORITES, -1),
    limit(LimitKey.MAX_ACTIVE_ALERTS, -1),
    limit(LimitKey.MAX_COMPARE_ITEMS, 5), // HOS-16: was 4 (SPEC-288 originally capped from -1); cascades to owner/complex
    // AI consumer quotas — graduated top tier (SPEC-283).
    limit(LimitKey.MAX_AI_SEARCH_PER_MONTH, 200),
    limit(LimitKey.MAX_AI_CHAT_CONSUMER_PER_MONTH, 200),
    // Search history cap — VIP tier (SPEC-289). tourist-plus overrides with 50.
    limit(LimitKey.MAX_SEARCH_HISTORY_ENTRIES, 200),
    // Favorites collections cap — VIP tier (SPEC-287). tourist-plus overrides with 10.
    limit(LimitKey.MAX_COLLECTIONS, 25)
];

// ─── OWNER PLANS ───────────────────────────────────────────────

export const OWNER_BASICO_PLAN: PlanDefinition = {
    slug: 'owner-basico',
    name: 'Basic',
    description: 'Basic plan for individual property owners. Ideal for getting started.',
    category: 'owner',
    monthlyPriceArs: 1800000, // ARS $18,000 (in cents) — HOS-301 D1
    annualPriceArs: 18000000, // ARS $180,000/year (2 months free) — HOS-301 D1
    monthlyPriceUsdRef: 18,
    hasTrial: true,
    trialDays: OWNER_TRIAL_DAYS,
    isDefault: true,
    sortOrder: 1,
    isActive: true,
    entitlements: dedupe([
        ...TOURIST_VIP_ENTITLEMENTS,
        // owner-specific
        EntitlementKey.PUBLISH_ACCOMMODATIONS,
        EntitlementKey.EDIT_ACCOMMODATION_INFO,
        EntitlementKey.VIEW_BASIC_STATS,
        EntitlementKey.RESPOND_REVIEWS,
        EntitlementKey.CAN_USE_CALENDAR,
        EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY,
        EntitlementKey.CREATE_PROMOTIONS,
        EntitlementKey.AI_TEXT_IMPROVE,
        EntitlementKey.AI_CHAT,
        EntitlementKey.AI_TRANSLATE,
        EntitlementKey.AI_ACCOMMODATION_IMPORT
        // ai_search has NO entitlement — auth-baseline, gated by per-plan quota only (SPEC-283)
        // ai_support deliberately ungranted pending SPEC-200 audience decision (owner 2026-06-05)
    ]),
    limits: mergeLimits(TOURIST_VIP_LIMITS, [
        limit(LimitKey.MAX_ACCOMMODATIONS, 1), // OQ-3: individual host
        limit(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 15), // HOS-16: was 5
        limit(LimitKey.MAX_ACTIVE_PROMOTIONS, 2), // HOS-16: was 0
        limit(LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH, 50), // HOS-16: was 20 (x5 ladder)
        limit(LimitKey.MAX_AI_CHAT_PER_MONTH, 50), // HOS-16: was 20 (x5 ladder)
        limit(LimitKey.MAX_AI_TRANSLATE_PER_MONTH, 200), // unchanged
        limit(LimitKey.MAX_AI_ACCOMMODATION_IMPORT_PER_MONTH, 10) // HOS-16: was 200, OQ-2 (one-off op)
        // AI search + consumer-chat quotas inherited at 200 from TOURIST_VIP_LIMITS
        // (SPEC-283 consumer tier). MAX_AI_CHAT_PER_MONTH above is the owner-side cost cap.
    ])
};

export const OWNER_PRO_PLAN: PlanDefinition = {
    slug: 'owner-pro',
    name: 'Professional',
    description: 'Professional plan with featured listing and more room to grow.',
    category: 'owner',
    monthlyPriceArs: 3500000, // ARS $35,000
    annualPriceArs: 35000000, // ARS $350,000/year
    monthlyPriceUsdRef: 35,
    hasTrial: true,
    trialDays: OWNER_TRIAL_DAYS,
    isDefault: false,
    sortOrder: 2,
    isActive: true,
    entitlements: dedupe([
        ...TOURIST_VIP_ENTITLEMENTS,
        // owner-specific
        EntitlementKey.PUBLISH_ACCOMMODATIONS,
        EntitlementKey.EDIT_ACCOMMODATION_INFO,
        EntitlementKey.VIEW_BASIC_STATS,
        EntitlementKey.RESPOND_REVIEWS,
        EntitlementKey.PRIORITY_SUPPORT,
        EntitlementKey.FEATURED_LISTING,
        EntitlementKey.CREATE_PROMOTIONS,
        EntitlementKey.CAN_USE_RICH_DESCRIPTION,
        EntitlementKey.CAN_EMBED_VIDEO,
        EntitlementKey.CAN_USE_CALENDAR,
        EntitlementKey.CAN_SYNC_EXTERNAL_CALENDAR,
        EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY,
        EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT,
        EntitlementKey.AI_TEXT_IMPROVE,
        EntitlementKey.AI_CHAT,
        EntitlementKey.AI_TRANSLATE,
        EntitlementKey.AI_ACCOMMODATION_IMPORT
        // ai_search has NO entitlement — auth-baseline, gated by per-plan quota only (SPEC-283)
        // ai_support deliberately ungranted pending SPEC-200 audience decision (owner 2026-06-05)
    ]),
    limits: mergeLimits(TOURIST_VIP_LIMITS, [
        limit(LimitKey.MAX_ACCOMMODATIONS, 3), // unchanged
        limit(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 30), // HOS-16: was 15
        limit(LimitKey.MAX_ACTIVE_PROMOTIONS, 5), // HOS-16: was 3
        limit(LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH, 250), // HOS-16: was 100 (x5 ladder)
        limit(LimitKey.MAX_AI_CHAT_PER_MONTH, 250), // HOS-16: was 100 (x5 ladder)
        limit(LimitKey.MAX_AI_TRANSLATE_PER_MONTH, 1000), // HOS-16: was 500
        limit(LimitKey.MAX_AI_ACCOMMODATION_IMPORT_PER_MONTH, 50) // HOS-16: was 500
        // AI search + consumer-chat quotas inherited at 200 from TOURIST_VIP_LIMITS
        // (SPEC-283 consumer tier). MAX_AI_CHAT_PER_MONTH above is the owner-side cost cap.
    ])
};

export const OWNER_PREMIUM_PLAN: PlanDefinition = {
    slug: 'owner-premium',
    name: 'Premium',
    description: 'Premium plan with all features, custom branding, and unlimited promotions.',
    category: 'owner',
    monthlyPriceArs: 6500000, // ARS $65,000 — HOS-301 D1
    annualPriceArs: 65000000, // ARS $650,000/year (2 months free) — HOS-301 D1
    monthlyPriceUsdRef: 65,
    hasTrial: true,
    trialDays: OWNER_TRIAL_DAYS,
    isDefault: false,
    sortOrder: 3,
    isActive: true,
    entitlements: dedupe([
        ...TOURIST_VIP_ENTITLEMENTS,
        // owner-specific
        EntitlementKey.PUBLISH_ACCOMMODATIONS,
        EntitlementKey.EDIT_ACCOMMODATION_INFO,
        EntitlementKey.VIEW_BASIC_STATS,
        EntitlementKey.VIEW_ADVANCED_STATS,
        EntitlementKey.RESPOND_REVIEWS,
        EntitlementKey.PRIORITY_SUPPORT,
        EntitlementKey.FEATURED_LISTING,
        EntitlementKey.CUSTOM_BRANDING,
        EntitlementKey.CREATE_PROMOTIONS,
        EntitlementKey.CAN_USE_RICH_DESCRIPTION,
        EntitlementKey.CAN_EMBED_VIDEO,
        EntitlementKey.CAN_USE_CALENDAR,
        EntitlementKey.CAN_SYNC_EXTERNAL_CALENDAR,
        EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY,
        EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT,
        EntitlementKey.HAS_VERIFICATION_BADGE,
        EntitlementKey.AI_TEXT_IMPROVE,
        EntitlementKey.AI_CHAT,
        EntitlementKey.AI_TRANSLATE,
        EntitlementKey.AI_ACCOMMODATION_IMPORT
        // ai_search has NO entitlement — auth-baseline, gated by per-plan quota only (SPEC-283)
        // ai_support deliberately ungranted pending SPEC-200 audience decision (owner 2026-06-05)
    ]),
    limits: mergeLimits(TOURIST_VIP_LIMITS, [
        limit(LimitKey.MAX_ACCOMMODATIONS, 10), // unchanged
        limit(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 50), // HOS-16: was 30
        limit(LimitKey.MAX_ACTIVE_PROMOTIONS, -1), // unlimited, unchanged
        // AI limits are finite (no -1) — cost guardrail (SPEC-211 Phase 0, §6.1).
        // HOS-16: normalizes the owner AI ladder to a uniform x5-per-tier
        // (basico 50 -> pro 250 -> premium 1250). Chat DROPS from 2000 to 1250 —
        // intentional; text-improve/translate/import all move upward.
        limit(LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH, 1250),
        limit(LimitKey.MAX_AI_CHAT_PER_MONTH, 1250),
        limit(LimitKey.MAX_AI_TRANSLATE_PER_MONTH, 5000),
        limit(LimitKey.MAX_AI_ACCOMMODATION_IMPORT_PER_MONTH, 250)
        // AI search + consumer-chat quotas inherited at 200 from TOURIST_VIP_LIMITS
        // (SPEC-283 consumer tier). MAX_AI_CHAT_PER_MONTH above is the owner-side cost cap.
    ])
};

// ─── COMPLEX PLANS ─────────────────────────────────────────────

export const COMPLEX_BASICO_PLAN: PlanDefinition = {
    slug: 'complex-basico',
    name: 'Complex Basic',
    description: 'Basic plan for complexes and hotels. Multi-property management.',
    category: 'complex',
    monthlyPriceArs: 5000000, // ARS $50,000
    annualPriceArs: 50000000, // ARS $500,000/year
    monthlyPriceUsdRef: 50,
    hasTrial: true,
    trialDays: COMPLEX_TRIAL_DAYS,
    isDefault: true,
    sortOrder: 1,
    isActive: false, // HOS-16: complex vertical not implemented; hidden but reversible
    entitlements: dedupe([
        ...TOURIST_VIP_ENTITLEMENTS,
        // complex-specific
        EntitlementKey.PUBLISH_ACCOMMODATIONS,
        EntitlementKey.EDIT_ACCOMMODATION_INFO,
        EntitlementKey.VIEW_BASIC_STATS,
        EntitlementKey.RESPOND_REVIEWS,
        EntitlementKey.MULTI_PROPERTY_MANAGEMENT,
        EntitlementKey.CAN_USE_CALENDAR,
        EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY,
        EntitlementKey.AI_TEXT_IMPROVE,
        EntitlementKey.AI_CHAT,
        EntitlementKey.AI_TRANSLATE,
        EntitlementKey.AI_ACCOMMODATION_IMPORT
        // ai_search has NO entitlement — auth-baseline, gated by per-plan quota only (SPEC-283)
        // ai_support deliberately ungranted pending SPEC-200 audience decision (owner 2026-06-05)
    ]),
    limits: mergeLimits(TOURIST_VIP_LIMITS, [
        limit(LimitKey.MAX_PROPERTIES, 3),
        limit(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 10),
        limit(LimitKey.MAX_STAFF_ACCOUNTS, 2),
        limit(LimitKey.MAX_ACTIVE_PROMOTIONS, 0),
        limit(LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH, 30),
        limit(LimitKey.MAX_AI_CHAT_PER_MONTH, 30),
        limit(LimitKey.MAX_AI_TRANSLATE_PER_MONTH, 300),
        limit(LimitKey.MAX_AI_ACCOMMODATION_IMPORT_PER_MONTH, 300)
        // AI search + consumer-chat quotas inherited at 200 from TOURIST_VIP_LIMITS
        // (SPEC-283 consumer tier). MAX_AI_CHAT_PER_MONTH above is the owner-side cost cap.
    ])
};

export const COMPLEX_PRO_PLAN: PlanDefinition = {
    slug: 'complex-pro',
    name: 'Complex Professional',
    description: 'Professional plan for complexes with consolidated analytics.',
    category: 'complex',
    monthlyPriceArs: 10000000, // ARS $100,000
    annualPriceArs: 100000000, // ARS $1,000,000/year
    monthlyPriceUsdRef: 100,
    hasTrial: true,
    trialDays: COMPLEX_TRIAL_DAYS,
    isDefault: false,
    sortOrder: 2,
    isActive: false, // HOS-16: complex vertical not implemented; hidden but reversible
    entitlements: dedupe([
        ...TOURIST_VIP_ENTITLEMENTS,
        // complex-specific
        EntitlementKey.PUBLISH_ACCOMMODATIONS,
        EntitlementKey.EDIT_ACCOMMODATION_INFO,
        EntitlementKey.VIEW_BASIC_STATS,
        EntitlementKey.VIEW_ADVANCED_STATS,
        EntitlementKey.RESPOND_REVIEWS,
        EntitlementKey.PRIORITY_SUPPORT,
        EntitlementKey.FEATURED_LISTING,
        EntitlementKey.MULTI_PROPERTY_MANAGEMENT,
        EntitlementKey.CONSOLIDATED_ANALYTICS,
        EntitlementKey.CENTRALIZED_BOOKING,
        EntitlementKey.STAFF_MANAGEMENT,
        EntitlementKey.CREATE_PROMOTIONS,
        EntitlementKey.CAN_USE_RICH_DESCRIPTION,
        EntitlementKey.CAN_EMBED_VIDEO,
        EntitlementKey.CAN_USE_CALENDAR,
        EntitlementKey.CAN_SYNC_EXTERNAL_CALENDAR,
        EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY,
        EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT,
        EntitlementKey.AI_TEXT_IMPROVE,
        EntitlementKey.AI_CHAT,
        EntitlementKey.AI_TRANSLATE,
        EntitlementKey.AI_ACCOMMODATION_IMPORT
        // ai_search has NO entitlement — auth-baseline, gated by per-plan quota only (SPEC-283)
        // ai_support deliberately ungranted pending SPEC-200 audience decision (owner 2026-06-05)
    ]),
    limits: mergeLimits(TOURIST_VIP_LIMITS, [
        limit(LimitKey.MAX_PROPERTIES, 10),
        limit(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 20),
        limit(LimitKey.MAX_STAFF_ACCOUNTS, 5),
        limit(LimitKey.MAX_ACTIVE_PROMOTIONS, 5),
        limit(LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH, 150),
        limit(LimitKey.MAX_AI_CHAT_PER_MONTH, 150),
        limit(LimitKey.MAX_AI_TRANSLATE_PER_MONTH, 500),
        limit(LimitKey.MAX_AI_ACCOMMODATION_IMPORT_PER_MONTH, 500)
        // AI search + consumer-chat quotas inherited at 200 from TOURIST_VIP_LIMITS
        // (SPEC-283 consumer tier). MAX_AI_CHAT_PER_MONTH above is the owner-side cost cap.
    ])
};

export const COMPLEX_PREMIUM_PLAN: PlanDefinition = {
    slug: 'complex-premium',
    name: 'Complex Premium',
    description: 'Premium plan for large complexes with all features.',
    category: 'complex',
    monthlyPriceArs: 20000000, // ARS $200,000
    annualPriceArs: 200000000, // ARS $2,000,000/year
    monthlyPriceUsdRef: 200,
    hasTrial: true,
    trialDays: COMPLEX_TRIAL_DAYS,
    isDefault: false,
    sortOrder: 3,
    isActive: false, // HOS-16: complex vertical not implemented; hidden but reversible
    entitlements: dedupe([
        ...TOURIST_VIP_ENTITLEMENTS,
        // complex-specific
        EntitlementKey.PUBLISH_ACCOMMODATIONS,
        EntitlementKey.EDIT_ACCOMMODATION_INFO,
        EntitlementKey.VIEW_BASIC_STATS,
        EntitlementKey.VIEW_ADVANCED_STATS,
        EntitlementKey.RESPOND_REVIEWS,
        EntitlementKey.PRIORITY_SUPPORT,
        EntitlementKey.FEATURED_LISTING,
        EntitlementKey.CUSTOM_BRANDING,
        EntitlementKey.MULTI_PROPERTY_MANAGEMENT,
        EntitlementKey.CONSOLIDATED_ANALYTICS,
        EntitlementKey.CENTRALIZED_BOOKING,
        EntitlementKey.STAFF_MANAGEMENT,
        EntitlementKey.CREATE_PROMOTIONS,
        EntitlementKey.CAN_USE_RICH_DESCRIPTION,
        EntitlementKey.CAN_EMBED_VIDEO,
        EntitlementKey.CAN_USE_CALENDAR,
        EntitlementKey.CAN_SYNC_EXTERNAL_CALENDAR,
        EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY,
        EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT,
        EntitlementKey.HAS_VERIFICATION_BADGE,
        EntitlementKey.AI_TEXT_IMPROVE,
        EntitlementKey.AI_CHAT,
        EntitlementKey.AI_TRANSLATE,
        EntitlementKey.AI_ACCOMMODATION_IMPORT
        // ai_search has NO entitlement — auth-baseline, gated by per-plan quota only (SPEC-283)
        // ai_support deliberately ungranted pending SPEC-200 audience decision (owner 2026-06-05)
    ]),
    limits: mergeLimits(TOURIST_VIP_LIMITS, [
        limit(LimitKey.MAX_PROPERTIES, -1), // unlimited
        limit(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 50),
        limit(LimitKey.MAX_STAFF_ACCOUNTS, -1), // unlimited
        limit(LimitKey.MAX_ACTIVE_PROMOTIONS, -1), // unlimited
        // AI limits are finite (no -1) — cost guardrail (SPEC-211 Phase 0, §6.1)
        limit(LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH, 2000),
        limit(LimitKey.MAX_AI_CHAT_PER_MONTH, 5000),
        limit(LimitKey.MAX_AI_TRANSLATE_PER_MONTH, 5000),
        limit(LimitKey.MAX_AI_ACCOMMODATION_IMPORT_PER_MONTH, 5000)
        // AI search + consumer-chat quotas inherited at 200 from TOURIST_VIP_LIMITS
        // (SPEC-283 consumer tier). MAX_AI_CHAT_PER_MONTH above is the owner-side cost cap.
    ])
};

// ─── TOURIST PLANS ─────────────────────────────────────────────

export const TOURIST_FREE_PLAN: PlanDefinition = {
    slug: 'tourist-free',
    name: 'Free',
    description: 'Free plan for tourists. Basic features included.',
    category: 'tourist',
    monthlyPriceArs: 0,
    annualPriceArs: null,
    monthlyPriceUsdRef: 0,
    hasTrial: false,
    trialDays: 0,
    isDefault: true,
    sortOrder: 1,
    isActive: true,
    entitlements: [
        EntitlementKey.SAVE_FAVORITES,
        EntitlementKey.WRITE_REVIEWS,
        EntitlementKey.READ_REVIEWS
        // can_view_recommendations moved to tourist-plus (HOS-16)
        // ai_chat removed from tourist plans (SPEC-211 T-003)
        // ai_search has NO entitlement — auth-baseline, gated by per-plan quota only (SPEC-283)
        // ai_support deliberately ungranted pending SPEC-200 audience decision (owner 2026-06-05)
    ],
    limits: [
        limit(LimitKey.MAX_FAVORITES, 5), // HOS-16: was 3
        // AI consumer quotas — entry tier (SPEC-283 §5). ai_chat stays
        // owner-governed; this consumer-side quota only caps the tourist's usage.
        limit(LimitKey.MAX_AI_SEARCH_PER_MONTH, 10),
        limit(LimitKey.MAX_AI_CHAT_CONSUMER_PER_MONTH, 10)
    ]
};

export const TOURIST_PLUS_PLAN: PlanDefinition = {
    slug: 'tourist-plus',
    name: 'Plus',
    description:
        'Plus plan for frequent tourists. Compare accommodations, search history, and price alerts.',
    category: 'tourist',
    monthlyPriceArs: 500000, // ARS $5,000
    annualPriceArs: 5000000, // ARS $50,000/year
    monthlyPriceUsdRef: 5,
    hasTrial: true,
    trialDays: TOURIST_TRIAL_DAYS,
    isDefault: false,
    sortOrder: 2,
    // HOS-301 D1: the tourist tier ships with a single paid plan (tourist-vip).
    // Deactivated rather than deleted, exactly like the complex-* plans: the
    // definition stays in ALL_PLANS so existing subscriptions keep resolving
    // their entitlements, and reversing the decision is a one-line change.
    isActive: false,
    entitlements: [
        EntitlementKey.SAVE_FAVORITES,
        EntitlementKey.WRITE_REVIEWS,
        EntitlementKey.READ_REVIEWS,
        EntitlementKey.PRICE_ALERTS,
        EntitlementKey.EXCLUSIVE_DEALS,
        EntitlementKey.CAN_COMPARE_ACCOMMODATIONS,
        EntitlementKey.CAN_ATTACH_REVIEW_PHOTOS,
        EntitlementKey.CAN_VIEW_SEARCH_HISTORY,
        EntitlementKey.CAN_VIEW_RECOMMENDATIONS,
        EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY,
        EntitlementKey.CAN_USE_COLLECTIONS
        // ai_chat removed from tourist plans (SPEC-211 T-003)
        // ai_search has NO entitlement — auth-baseline, gated by per-plan quota only (SPEC-283)
        // ai_support deliberately ungranted pending SPEC-200 audience decision (owner 2026-06-05)
    ],
    limits: [
        limit(LimitKey.MAX_FAVORITES, 25), // HOS-16: was 20
        limit(LimitKey.MAX_ACTIVE_ALERTS, 5),
        limit(LimitKey.MAX_COMPARE_ITEMS, 3), // HOS-16: was 2 (coord SPEC-288)
        // AI consumer quotas — mid tier (SPEC-283 §5).
        limit(LimitKey.MAX_AI_SEARCH_PER_MONTH, 50),
        limit(LimitKey.MAX_AI_CHAT_CONSUMER_PER_MONTH, 50),
        // Search history cap — Plus tier (SPEC-289). VIP/owner/complex inherit 200.
        limit(LimitKey.MAX_SEARCH_HISTORY_ENTRIES, 50),
        // Favorites collections cap — Plus tier (SPEC-287). VIP/owner/complex inherit 25.
        limit(LimitKey.MAX_COLLECTIONS, 10)
    ]
};

export const TOURIST_VIP_PLAN: PlanDefinition = {
    slug: 'tourist-vip',
    name: 'VIP',
    description: 'VIP plan for discerning tourists. All premium features included.',
    category: 'tourist',
    monthlyPriceArs: 1500000, // ARS $15,000
    annualPriceArs: 15000000, // ARS $150,000/year
    monthlyPriceUsdRef: 15,
    hasTrial: true,
    trialDays: TOURIST_TRIAL_DAYS,
    isDefault: false,
    sortOrder: 3,
    isActive: true,
    // Single source of truth for the tourist-VIP tier. Owner/complex plans inherit
    // the SAME constants (SPEC-216), so the tourist tier and owner inheritance can
    // never drift. ai_chat/ai_search/ai_support stay ungranted on tourist plans
    // (SPEC-211 T-003/T-004, SPEC-200).
    entitlements: [...TOURIST_VIP_ENTITLEMENTS],
    limits: [...TOURIST_VIP_LIMITS]
};

// ─── COMMERCE PLAN (SPEC-239) ──────────────────────────────────

/**
 * Commerce-listing plan (SPEC-239 T-049).
 *
 * A single flat subscription that makes a commerce listing (gastronomy,
 * experience, etc.) visible. It is **deliberately NOT part of {@link ALL_PLANS}**:
 * the accommodation seed loop, the public/accommodation plan list, and the
 * grant-matrix snapshot tests all operate on `ALL_PLANS` and must stay
 * accommodation-only. This plan is seeded by its own helper
 * (`seedCommercePlan`) which stamps `billing_plans.product_domain='commerce'`
 * so the public plans endpoint and the web pricing pages exclude it.
 *
 * `category` is set to `'owner'` ONLY to satisfy the {@link PlanCategory} type
 * (D-ISOLATION forbids widening `PlanCategory` to add `'commerce'`, which would
 * ripple through every `Record<PlanCategory>` usage). The real domain
 * discriminator is the `product_domain` column, not this field — nothing in the
 * accommodation flow ever reads this plan because it is excluded from
 * `ALL_PLANS` and filtered out by product_domain.
 *
 * NOTE (owner): `monthlyPriceArs` below is CONFIRMED at ARS 15,000.00 (owner
 * 2026-07-22, HOS-166 OQ-2). It is still a commercial-layer field — the seed
 * never overwrites it once a value exists in the DB — so any operator
 * override made afterward via the admin UI stands.
 *
 * `hasTrial=false`, `entitlements=[]`, `limits=[]`: commerce visibility is
 * driven by the subscription status via the `commerce_listing_subscriptions`
 * link table + the visibility reconciler, NOT by the billing entitlement engine.
 */
export const COMMERCE_LISTING_PLAN: PlanDefinition = {
    slug: 'commerce-listing',
    name: 'Commerce Listing',
    description: 'Subscription that makes a commerce listing visible (SPEC-239).',
    // See JSDoc: 'owner' only satisfies the PlanCategory type; product_domain is
    // the real discriminator. Do NOT widen PlanCategory to add 'commerce'.
    category: 'owner',
    // CONFIRMED price (owner 2026-07-22, HOS-166 OQ-2): ARS 15,000.00 in cents.
    monthlyPriceArs: 1500000,
    annualPriceArs: null,
    monthlyPriceUsdRef: 15,
    hasTrial: false,
    trialDays: 0,
    isDefault: false,
    sortOrder: 1,
    isActive: true,
    entitlements: [],
    limits: []
};

// ─── PER-VERTICAL COMMERCE PLANS (HOS-688) ─────────────────────

/**
 * Monthly price of every ENABLED commerce tier, in centavos.
 *
 * ARS $15.000 — the exact amount {@link COMMERCE_LISTING_PLAN} charges today
 * (owner 2026-07-22, HOS-166 OQ-2). HOS-688 turns one subscription-per-LISTING
 * into one subscription-per-OWNER-per-VERTICAL, and deliberately keeps the
 * price: nobody paying today sees a change, they simply get one listing for the
 * same money under a plan that is theirs rather than the listing's.
 *
 * Like every price in this file it is a `'commercial'` field — the database
 * wins, so an operator override through the admin UI stands and moving the
 * number in production is a data-migration, not a deploy.
 */
export const COMMERCE_VERTICAL_MONTHLY_PRICE_ARS = 1500000;

/**
 * Builds one tier of a per-vertical commerce catalogue (HOS-688 §6.8).
 *
 * Every tier declares EXACTLY ONE limit — its own vertical's listing cap — and
 * nothing else. That absence is deliberate and is not the same as `-1`: both
 * resolve to unlimited downstream, but an absent key reads as "this plan does
 * not meter that", which is what is true here. A gastronomy plan has no opinion
 * about photos, promotions or AI quotas.
 *
 * @param input.slug - Plan slug (`gastronomy-premium`, …).
 * @param input.name - Buyer-visible display name; becomes MercadoPago's `reason`.
 * @param input.description - Admin-facing description.
 * @param input.limitKey - The vertical's cap key.
 * @param input.maxListings - Value of that cap for this tier.
 * @param input.sortOrder - Display order within the vertical.
 * @param input.isActive - Whether the tier is sellable. Only premium is today.
 * @param input.monthlyPriceArs - Monthly price in centavos; `0` for a tier that
 *   has not been priced yet, which is also why such a tier ships inactive.
 * @param input.hasTrial - Whether the tier grants a free trial (HOS-590).
 *   Defaults to `false` — the two disabled tiers per vertical have no price
 *   and are not sellable, so a trial has nothing to precede.
 * @param input.trialDays - Trial length in days when `hasTrial` is `true`.
 *   Defaults to `0`.
 * @returns The tier's {@link PlanDefinition}.
 */
function commerceVerticalTier(input: {
    slug: string;
    name: string;
    description: string;
    limitKey: LimitKey;
    maxListings: number;
    sortOrder: number;
    isActive: boolean;
    monthlyPriceArs: number;
    hasTrial?: boolean;
    trialDays?: number;
}): PlanDefinition {
    return {
        slug: input.slug,
        name: input.name,
        description: input.description,
        // See COMMERCE_LISTING_PLAN's JSDoc: 'owner' only satisfies the
        // PlanCategory type. product_domain ('gastronomy' / 'experience') is the
        // real discriminator, stamped by `seedCommercePlan`.
        category: 'owner',
        monthlyPriceArs: input.monthlyPriceArs,
        annualPriceArs: null,
        monthlyPriceUsdRef: Math.round(input.monthlyPriceArs / 100000),
        // HOS-590: the enabled (premium) tier of each vertical now declares the
        // same 30-day trial every accommodation plan does; the two disabled
        // tiers keep the prior no-trial defaults since they are not sellable.
        hasTrial: input.hasTrial ?? false,
        trialDays: input.trialDays ?? 0,
        isDefault: false,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
        // Neither vertical grants any entitlement today (§6.8). Commerce
        // visibility is driven by the subscription status through
        // `commerce_listing_subscriptions` + the reconciler, not by the
        // entitlement engine — so the limit check on the create route runs with
        // no entitlement gate ahead of it, unlike accommodation's
        // `requireEntitlement(PUBLISH_ACCOMMODATIONS)` + `enforceAccommodationLimit()`
        // pair. There is simply nothing to put in the first half of that pattern.
        entitlements: [],
        limits: [limit(input.limitKey, input.maxListings)]
    };
}

/**
 * The gastronomy catalogue (HOS-688 §6.8).
 *
 * Built for the full three-tier shape so enabling a tier later is a
 * data-migration rather than a code change, but **only premium is enabled**.
 * The two disabled tiers carry `monthlyPriceArs: 0` because they have not been
 * priced — shipping them inactive is the same precedent {@link AI_SUPPORT_ADDON}
 * set for a definition whose price is still TBD, and `seedCommercePlan` skips
 * the `billing_prices` row for a tier priced at zero rather than seeding a free
 * one.
 *
 * Deliberately excluded from {@link ALL_PLANS}, exactly like
 * {@link COMMERCE_LISTING_PLAN}: the accommodation seed loop, the public plan
 * list and the grant-matrix snapshot tests all operate on `ALL_PLANS` and must
 * stay accommodation-only.
 */
export const GASTRONOMY_BASICO_PLAN: PlanDefinition = commerceVerticalTier({
    slug: 'gastronomy-basico',
    name: 'Gastronomía Básico',
    description: 'Gastronomy listing plan — basic tier (not enabled yet, HOS-688).',
    limitKey: LimitKey.MAX_GASTRONOMIES,
    maxListings: 1,
    sortOrder: 1,
    isActive: false,
    monthlyPriceArs: 0
});

/** Gastronomy professional tier. See {@link GASTRONOMY_BASICO_PLAN}. */
export const GASTRONOMY_PRO_PLAN: PlanDefinition = commerceVerticalTier({
    slug: 'gastronomy-pro',
    name: 'Gastronomía Profesional',
    description: 'Gastronomy listing plan — professional tier (not enabled yet, HOS-688).',
    limitKey: LimitKey.MAX_GASTRONOMIES,
    maxListings: 1,
    sortOrder: 2,
    isActive: false,
    monthlyPriceArs: 0
});

/**
 * Gastronomy premium tier — **the only sellable gastronomy plan today**.
 *
 * One listing for {@link COMMERCE_VERTICAL_MONTHLY_PRICE_ARS}. The cap is the
 * entire commercial substance of §6.8, and every layer beneath it resolves an
 * unknown limit key to *unlimited* without raising anything — so the wiring on
 * the create route, not this value, is what actually makes it real.
 *
 * HOS-590: carries the same 30-day trial as every accommodation plan
 * ({@link COMMERCE_TRIAL_DAYS}) — checkout resolves it through
 * `resolveCheckoutFreeTrialDays`, the same canonical resolver the
 * accommodation paths use.
 */
export const GASTRONOMY_PREMIUM_PLAN: PlanDefinition = commerceVerticalTier({
    slug: 'gastronomy-premium',
    name: 'Gastronomía Premium',
    description: 'Gastronomy listing plan — one listing per owner (HOS-688).',
    limitKey: LimitKey.MAX_GASTRONOMIES,
    maxListings: 1,
    sortOrder: 3,
    isActive: true,
    monthlyPriceArs: COMMERCE_VERTICAL_MONTHLY_PRICE_ARS,
    hasTrial: true,
    trialDays: COMMERCE_TRIAL_DAYS
});

/** Experience basic tier. See {@link GASTRONOMY_BASICO_PLAN} for the shape. */
export const EXPERIENCE_BASICO_PLAN: PlanDefinition = commerceVerticalTier({
    slug: 'experience-basico',
    name: 'Experiencias Básico',
    description: 'Experience listing plan — basic tier (not enabled yet, HOS-688).',
    limitKey: LimitKey.MAX_EXPERIENCES,
    maxListings: 1,
    sortOrder: 1,
    isActive: false,
    monthlyPriceArs: 0
});

/** Experience professional tier. See {@link GASTRONOMY_BASICO_PLAN}. */
export const EXPERIENCE_PRO_PLAN: PlanDefinition = commerceVerticalTier({
    slug: 'experience-pro',
    name: 'Experiencias Profesional',
    description: 'Experience listing plan — professional tier (not enabled yet, HOS-688).',
    limitKey: LimitKey.MAX_EXPERIENCES,
    maxListings: 1,
    sortOrder: 2,
    isActive: false,
    monthlyPriceArs: 0
});

/**
 * Experience premium tier — **the only sellable experience plan today**.
 * See {@link GASTRONOMY_PREMIUM_PLAN}.
 *
 * A distinct plan from gastronomy's, not a shared one, and that is worth its
 * own sentence: MercadoPago scopes a free trial to `(payer, preapproval_plan)`,
 * so an owner who spends their trial on gastronomy still receives one when they
 * later add an experience. A single pooled commerce plan would have silently
 * charged them from day one while the page promised a trial.
 */
export const EXPERIENCE_PREMIUM_PLAN: PlanDefinition = commerceVerticalTier({
    slug: 'experience-premium',
    name: 'Experiencias Premium',
    description: 'Experience listing plan — one listing per owner (HOS-688).',
    limitKey: LimitKey.MAX_EXPERIENCES,
    maxListings: 1,
    sortOrder: 3,
    isActive: true,
    monthlyPriceArs: COMMERCE_VERTICAL_MONTHLY_PRICE_ARS,
    hasTrial: true,
    trialDays: COMMERCE_TRIAL_DAYS
});

/** Every gastronomy-domain plan the seed maintains, in display order. */
export const ALL_GASTRONOMY_PLANS: readonly PlanDefinition[] = [
    GASTRONOMY_BASICO_PLAN,
    GASTRONOMY_PRO_PLAN,
    GASTRONOMY_PREMIUM_PLAN
];

/** Every experience-domain plan the seed maintains, in display order. */
export const ALL_EXPERIENCE_PLANS: readonly PlanDefinition[] = [
    EXPERIENCE_BASICO_PLAN,
    EXPERIENCE_PRO_PLAN,
    EXPERIENCE_PREMIUM_PLAN
];

/**
 * The slug of the sellable plan for each commerce vertical (HOS-688).
 *
 * This is the DEFAULT the environment may override, not the resolution itself:
 * `resolveCommercePlanSlug` in `apps/api` is the single place a vertical is
 * turned into a plan slug (AC-35), and a CI guard fails on any other module
 * that does it.
 */
export const DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL = {
    gastronomy: GASTRONOMY_PREMIUM_PLAN.slug,
    experience: EXPERIENCE_PREMIUM_PLAN.slug
} as const;

/**
 * Dedicated partner-directory plan (SPEC-271).
 *
 * Seeded into `billing_plans` and stamped with `product_domain='partner'`, but
 * intentionally excluded from `ALL_PLANS` so accommodation pricing surfaces do
 * not expose it.
 */
export const PARTNER_LISTING_PLAN: PlanDefinition = {
    slug: 'partner-listing',
    name: 'Partner Listing',
    description: 'Subscription that makes a partner visible in the public directory (SPEC-271).',
    category: 'owner',
    monthlyPriceArs: 500000,
    annualPriceArs: null,
    monthlyPriceUsdRef: 5,
    hasTrial: false,
    trialDays: 0,
    isDefault: false,
    sortOrder: 1,
    isActive: true,
    entitlements: [],
    limits: []
};

/**
 * The two commercial partner tiers (HOS-278 D4, §6.3).
 *
 * Both carry `product_domain='partner'` and, like {@link PARTNER_LISTING_PLAN},
 * are intentionally excluded from `ALL_PLANS` so accommodation pricing surfaces
 * never expose them.
 *
 * ## Prices
 *
 * Monthly figures are the owner's (2026-08-06): silver ARS 15,000, gold ARS
 * 30,000. The annual figures are DERIVED, not separately decided — every plan
 * in this file prices a year at ten months (`annualPriceArs = monthlyPriceArs
 * × 10`, "2 months free", 16.67% off) and these follow the same rule. If that
 * rule ever changes, it changes here for all of them together.
 *
 * ## Why only two cadences
 *
 * §6.3 asks for monthly, quarterly, semiannual and annual. Only two are
 * shipped, and that is a platform limit rather than a commercial choice:
 * `ensurePrice` in the seed hardcodes `intervalCount: 1` in both its lookup and
 * its insert, and the only downstream lookups are `findMonthlyPrice` /
 * `findAnnualPrice`. Quarterly and semiannual would be `month × 3` and
 * `month × 6` — MercadoPago supports them, this pipeline cannot express them
 * yet. Adding them means touching price seeding, the lookups and the partner
 * checkout, all shared with accommodation billing, so it was split out rather
 * than bolted on here.
 */
export const PARTNER_SILVER_PLAN: PlanDefinition = {
    slug: 'partner-silver',
    name: 'Partner Silver',
    description: 'Partner tier with carousel presence (HOS-278 §6.3).',
    // See PARTNER_LISTING_PLAN: 'owner' only satisfies the PlanCategory type;
    // product_domain is the real discriminator.
    category: 'owner',
    monthlyPriceArs: 1500000,
    annualPriceArs: 15000000,
    monthlyPriceUsdRef: 15,
    hasTrial: false,
    trialDays: 0,
    isDefault: false,
    sortOrder: 2,
    isActive: true,
    // Empty for the same reason COMMERCE_LISTING_PLAN's are: partner visibility
    // is driven by the subscription status and the partner row's own
    // lifecycle/subscription columns, NOT by the entitlement engine.
    entitlements: [],
    limits: []
};

/** Gold tier. See {@link PARTNER_SILVER_PLAN} for the pricing rule. */
export const PARTNER_GOLD_PLAN: PlanDefinition = {
    slug: 'partner-gold',
    name: 'Partner Gold',
    description:
        'Partner tier with carousel presence plus a dedicated /partners/<slug>/ page (HOS-278 §6.3).',
    category: 'owner',
    monthlyPriceArs: 3000000,
    annualPriceArs: 30000000,
    monthlyPriceUsdRef: 30,
    hasTrial: false,
    trialDays: 0,
    isDefault: false,
    sortOrder: 3,
    isActive: true,
    entitlements: [],
    limits: []
};

/**
 * Every partner-domain plan the seed maintains, in display order.
 *
 * `PARTNER_LISTING_PLAN` stays in the list and stays ACTIVE on purpose. It
 * predates the tiers and a live partner row may still point its `plan_id` at
 * it; deactivating it here would strand that partner's subscription lookup
 * without anything saying so. Retiring it is a data decision about real rows,
 * not a config edit, so it is deliberately left for a follow-up.
 */
export const ALL_PARTNER_PLANS: readonly PlanDefinition[] = [
    PARTNER_LISTING_PLAN,
    PARTNER_SILVER_PLAN,
    PARTNER_GOLD_PLAN
];

// ─── TEST DAILY PLAN (testing-only, HOSPEDA_SHOW_TEST_BILLING_PLAN) ────────

/**
 * Real ARS charge amount (in centavos) for the daily test plan's single
 * price row. ARS $15.00 (1500 centavos) — MercadoPago's confirmed minimum
 * `transaction_amount` for a recurring `preapproval` in Argentina. An
 * earlier revision of this constant used ARS $1.00 (100 centavos), assuming
 * that was the practical floor; MercadoPago's real API rejected it in
 * production with `Create subscription - Cannot pay an amount lower than
 * $ 15.00`, causing every checkout onto this plan to fail with a generic
 * `INTERNAL_ERROR`. 1500 is not an arbitrary "small" value — it is the
 * lowest amount MP will actually accept, so do NOT lower this again without
 * first re-confirming MP's minimum has changed.
 *
 * Exported so the seed (`seedTestDailyPlan`) and this config share the exact
 * same value — never duplicate the literal `1500` in two places.
 */
export const TEST_DAILY_PLAN_UNIT_AMOUNT_CENTAVOS = 1500;

/**
 * Testing-only daily-cadence plan (billing-interval-override tooling).
 *
 * A dedicated HIDDEN plan that bills every 1 day instead of monthly, so an
 * operator can exercise the FULL recurring-charge lifecycle (MercadoPago
 * preapproval creation, `subscription_authorized_payment.created` webhooks,
 * dunning, cancellation) on a realistic cadence without waiting a month
 * between charges. MercadoPago's recurring frequency is derived ENTIRELY
 * from the `billing_prices` row a subscription is created against —
 * `toMercadoPagoInterval` in `@qazuor/qzpay-mercadopago` already maps
 * `billingInterval: 'day'` -> MP `frequency_type: 'days'` — so a plan whose
 * ONLY price has `billingInterval: 'day', intervalCount: 1` makes MP charge
 * daily. No qzpay change required; this is Hospeda-only config + seed +
 * gating.
 *
 * **Deliberately NOT part of {@link ALL_PLANS}** — same isolation precedent
 * as {@link COMMERCE_LISTING_PLAN} / {@link PARTNER_LISTING_PLAN}: the
 * accommodation seed loop, the public plan list, and the grant-matrix
 * snapshot tests all operate on `ALL_PLANS` and must never see this plan.
 * It is seeded by its own dedicated helper (`seedTestDailyPlan` in
 * `@repo/seed`), which stamps `metadata.testPlan = true` in the DB row for
 * extra identifiability beyond the `owner-test-daily` slug alone.
 *
 * `product_domain` is EXPLICITLY `'accommodation'` — UNLIKE commerce/partner,
 * which use their own domains — so `loadEntitlements()` (which filters
 * `product_domain = 'accommodation'`) actually resolves this subscription's
 * entitlements/limits. Without this the subscription would exist but grant
 * nothing, defeating the point of testing the full paid-owner lifecycle on a
 * fast cadence.
 *
 * `entitlements` / `limits` are copied VERBATIM from {@link OWNER_PREMIUM_PLAN}
 * so a test subscription on this plan behaves identically to a real premium
 * owner subscription for every entitlement/limit check — only the billing
 * cadence and price differ. If `OWNER_PREMIUM_PLAN`'s grants change, this
 * plan's grants change with it (single source of truth, not a fork).
 *
 * Subscribing to this plan is gated by `HOSPEDA_SHOW_TEST_BILLING_PLAN`
 * (checked in `resolvePlanBySlug` inside
 * `apps/api/src/services/subscription-checkout.service.ts`), NOT by this
 * config or the seed — the row always exists in `billing_plans` /
 * `billing_prices` once seeded (so flipping the flag back on instantly makes
 * it subscribable again for repeat testing); the env flag is the SOLE gate
 * on whether a checkout can resolve this plan by slug.
 *
 * No monthly/annual price is ever seeded for this plan — it is DAILY-ONLY.
 * `monthlyPriceArs` below is a type-satisfying placeholder (mirrors
 * {@link TEST_DAILY_PLAN_UNIT_AMOUNT_CENTAVOS}) that `seedTestDailyPlan`
 * never reads to create a `'month'` price row.
 */
export const TEST_DAILY_PLAN: PlanDefinition = {
    slug: 'owner-test-daily',
    name: 'Test Daily (internal)',
    description:
        "Testing-only plan that bills every 1 day at MercadoPago's minimum preapproval amount (ARS $15.00). Hidden unless HOSPEDA_SHOW_TEST_BILLING_PLAN is set. Not a real product tier.",
    // See JSDoc: 'owner' only satisfies the PlanCategory type; product_domain
    // (stamped by the seed as 'accommodation') is what makes entitlements load.
    category: 'owner',
    // PLACEHOLDER — never seeded as a 'month' price row (daily-only plan).
    monthlyPriceArs: TEST_DAILY_PLAN_UNIT_AMOUNT_CENTAVOS,
    annualPriceArs: null,
    monthlyPriceUsdRef: 0,
    // 1-day trial so the full trial lifecycle (a trialing subscription, then
    // the daily `trial-reconcile` cron mirroring whatever MercadoPago decided
    // once the 1-day trial elapses) is exercisable end-to-end
    // on a fast cadence. A no-card trial carries NO MercadoPago preapproval
    // (`mp_subscription_id` stays NULL) — nothing auto-charges when the
    // trial ends; converting to paid requires the user to go through a
    // SEPARATE `/start-paid` checkout. See the dual-write counterpart
    // `packages/seed/src/data-migrations/0005-owner-test-daily-trial.ts`
    // for the already-seeded-environment backfill.
    hasTrial: true,
    trialDays: 1,
    isDefault: false,
    sortOrder: 999,
    // Seeded INACTIVE on purpose. The public plans endpoint
    // (`/api/v1/public/plans` → `PlanService.list({ active: true })`) filters to
    // active plans, so `active: false` keeps this test plan off the public
    // pricing page WITHOUT any endpoint change. The checkout still resolves it:
    // `resolvePlanBySlug` calls `billing.plans.list()` with no `active` filter
    // (qzpay-drizzle `search` only filters active when asked), so the inactive
    // plan is still found — and only when HOSPEDA_SHOW_TEST_BILLING_PLAN is on.
    // The daily `billing_prices` row stays active (create resolves the price via
    // `findByPlanId(activeOnly=true)`).
    isActive: false,
    entitlements: [...OWNER_PREMIUM_PLAN.entitlements],
    limits: [...OWNER_PREMIUM_PLAN.limits]
};

// ─── ALL PLANS ─────────────────────────────────────────────────

/**
 * All available plans in the system.
 *
 * The 3 `complex-*` plans were removed (HOS-692, spec §6.9) — zero live
 * subscriptions, and the multi-property vertical they were for is not
 * implemented. Their `PlanDefinition` constants stay exported above (still
 * referenced by `packages/billing/test/plans.test.ts` and by nothing else in
 * production) so this file remains the single source for their shape if the
 * vertical is ever built, but they no longer seed a row or appear in any
 * public listing. This deliberately leaves the `complex` category of
 * {@link PLANS_BY_CATEGORY} empty — see `0066-hos-692-domain-rewrite-and-plan-cleanup`
 * for the data-migration that removes the already-seeded rows.
 */
export const ALL_PLANS: PlanDefinition[] = [
    OWNER_BASICO_PLAN,
    OWNER_PRO_PLAN,
    OWNER_PREMIUM_PLAN,
    TOURIST_FREE_PLAN,
    TOURIST_PLUS_PLAN,
    TOURIST_VIP_PLAN
];

/** Plans grouped by category. `complex` is deliberately empty — see {@link ALL_PLANS}. */
export const PLANS_BY_CATEGORY = {
    owner: [OWNER_BASICO_PLAN, OWNER_PRO_PLAN, OWNER_PREMIUM_PLAN],
    complex: [] as const,
    tourist: [TOURIST_FREE_PLAN, TOURIST_PLUS_PLAN, TOURIST_VIP_PLAN]
} as const;

/**
 * Retrieves a plan definition by its unique slug identifier.
 *
 * @param slug - The unique slug of the plan to find (e.g. 'owner-basico')
 * @returns The matching PlanDefinition, or undefined if not found
 *
 * @example
 * ```ts
 * const plan = getPlanBySlug('owner-basico');
 * if (plan) {
 *     console.log(`Plan: ${plan.name} - ${plan.monthlyPriceArs / 100} ARS/month`);
 * }
 * ```
 */
export function getPlanBySlug(slug: string): PlanDefinition | undefined {
    return ALL_PLANS.find((plan) => plan.slug === slug);
}

/**
 * Retrieves the default plan for a given plan category.
 *
 * Each category (owner, complex, tourist) has exactly one default plan
 * that is automatically assigned to new users of that type.
 *
 * @param category - The plan category ('owner', 'complex', or 'tourist')
 * @returns The default PlanDefinition for the specified category
 * @throws {Error} If no default plan is found for the category (system misconfiguration)
 *
 * @example
 * ```ts
 * const defaultOwnerPlan = getDefaultPlan('owner');
 * console.log(`Default: ${defaultOwnerPlan.name}`); // "Basic"
 * ```
 */
export function getDefaultPlan(category: PlanDefinition['category']): PlanDefinition {
    const plan = ALL_PLANS.find((p) => p.category === category && p.isDefault);
    if (!plan) {
        throw new Error(`No default plan found for category: ${category}`);
    }
    return plan;
}

/**
 * Returns the entitlements and limits granted to authenticated users that do
 * not have an active paid subscription (SPEC-143 T-143-58).
 *
 * The fallback resolves to {@link TOURIST_FREE_PLAN} unconditionally — owner
 * and complex defaults are paid plans (with trials) so auto-granting their
 * entitlements without a payment intent is incorrect; those flows go through
 * an explicit checkout. Tourist-free is the only truly free default plan and
 * it is what every authenticated user should receive by default.
 *
 * Returned as the raw plan shape (`EntitlementKey[]` + `LimitDefinition[]`).
 * The caller is responsible for materializing to the runtime shape the
 * entitlement middleware uses (`Set<EntitlementKey>` + `Map<LimitKey, number>`).
 *
 * Pure: reads only the in-memory plan config — safe to call on every request.
 *
 * @example
 * ```ts
 * const { entitlements, limits } = getDefaultEntitlements();
 * const entitlementSet = new Set(entitlements);
 * const limitMap = new Map(limits.map((l) => [l.key, l.value]));
 * ```
 */
export function getDefaultEntitlements(): Pick<PlanDefinition, 'entitlements' | 'limits'> {
    return {
        entitlements: TOURIST_FREE_PLAN.entitlements,
        limits: TOURIST_FREE_PLAN.limits
    };
}

/**
 * Returns an "unlimited" entitlement set: every {@link EntitlementKey} granted
 * and every {@link LimitKey} set to the unlimited sentinel (`-1`) (SPEC-171).
 *
 * This is NOT a plan. It is the entitlement shape granted to platform staff
 * (e.g. `SUPER_ADMIN`, `ADMIN`, `EDITOR`, `CLIENT_MANAGER`) who operate the
 * admin panel without a billing customer/subscription. Treating "no plan" as
 * "no entitlements" for staff is wrong — they manage content on behalf of the
 * platform, so the resolver grants them everything instead of forcing the
 * frontend to special-case roles. See {@link getDefaultEntitlements} for the
 * regular no-subscription fallback.
 *
 * Derived from the enums via `Object.values`, so any new entitlement or limit
 * key is included automatically (no drift). The caller decides WHO receives
 * this set; this function is role-agnostic.
 *
 * Returned as the raw plan shape (`EntitlementKey[]` + `LimitDefinition[]`),
 * matching {@link getDefaultEntitlements} so callers materialize both the same
 * way.
 *
 * Pure: reads only the static enums + in-memory limit metadata.
 *
 * @example
 * ```ts
 * const { entitlements, limits } = getUnlimitedEntitlements();
 * const entitlementSet = new Set(entitlements);
 * const limitMap = new Map(limits.map((l) => [l.key, l.value]));
 * ```
 */
export function getUnlimitedEntitlements(): Pick<PlanDefinition, 'entitlements' | 'limits'> {
    return {
        entitlements: Object.values(EntitlementKey),
        limits: Object.values(LimitKey).map((key) => limit(key, -1))
    };
}
