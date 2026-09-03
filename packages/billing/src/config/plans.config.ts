import {
    COMMERCE_TRIAL_DAYS,
    COMPLEX_TRIAL_DAYS,
    OWNER_TRIAL_DAYS,
    TOURIST_TRIAL_DAYS
} from '../constants/billing.constants.js';
import { EntitlementKey } from '../types/entitlement.types.js';
import { LimitKey, type PlanDefinition } from '../types/plan.types.js';
import { ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL } from './commerce-entitlements.config.js';
import {
    AI_CHAT_LIMIT_KEY_BY_COMMERCE_VERTICAL,
    type CommerceVertical,
    LIMIT_KEY_BY_COMMERCE_VERTICAL
} from './commerce-limits.config.js';
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

// ─── PER-VERTICAL COMMERCE PLANS (HOS-688) ─────────────────────

/**
 * Monthly price of every ENABLED commerce tier, in centavos.
 *
 * ARS $15.000 — the price the single pre-HOS-688 `commerce-listing` plan
 * charged (owner 2026-07-22, HOS-166 OQ-2), before HOS-688 split it into one
 * subscription-per-OWNER-per-VERTICAL. HOS-688 deliberately kept the price:
 * nobody paying at the time saw a change, they simply got one listing for the
 * same money under a plan that is theirs rather than the listing's.
 *
 * Like every price in this file it is a `'commercial'` field — the database
 * wins, so an operator override through the admin UI stands and moving the
 * number in production is a data-migration, not a deploy.
 */
export const COMMERCE_VERTICAL_MONTHLY_PRICE_ARS = 1500000;

/**
 * Monthly AI-chat quota of a commerce tier that GRANTS the chat (HOS-400).
 *
 * 250 calls/month, borne by the listing's owner. The number is the
 * accommodation `owner-pro` rung (`MAX_AI_CHAT_PER_MONTH: 250`) rather than a
 * new ladder: a restaurant's ficha and a mid-tier host's ficha field roughly the
 * same volume of visitor questions, and inventing a third scale for commerce
 * would have to be justified by traffic nobody has measured yet.
 *
 * Shared by both verticals on purpose. Nothing yet distinguishes what a diner
 * asks a restaurant from what a traveller asks an excursion, so a single
 * constant keeps the two catalogues from drifting apart for no reason. Split it
 * the day one vertical's real usage says it should be.
 *
 * Like every cap in this file it is a `'commercial'` field: the database wins,
 * so an operator override stands and changing it in production is a
 * data-migration, not a deploy.
 */
export const COMMERCE_AI_CHAT_PER_MONTH = 250;

/**
 * Builds one tier of a per-vertical commerce catalogue (HOS-688 §6.8).
 *
 * Every tier declares EXACTLY TWO limits, both scoped to its own vertical: the
 * listing cap, and — since HOS-400 — the monthly AI-chat quota. Everything else
 * is deliberately absent, and that absence is not the same as `-1`: both resolve
 * to unlimited downstream, but an absent key reads as "this plan does not meter
 * that", which is what is true here. A gastronomy plan still has no opinion
 * about photos, promotions, or any AI quota other than its own chat.
 *
 * The chat quota was NOT left absent for exactly that reason. "This plan does
 * not meter the chat" and "this plan grants an uncapped chat" are the same
 * value downstream, and only one of them is true of a tier that does not sell
 * the feature — so every tier states a number, and the tiers without the
 * capability state `0`. See `input.aiChatPerMonth` below.
 *
 * ## Entitlements (HOS-1074)
 *
 * Every tier of a vertical grants that vertical's pair —
 * `EDIT_<VERTICAL>_INFO` and `PUBLISH_<VERTICAL>` — read from
 * {@link ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL} rather than spelled out per
 * tier, so a tier can never be defined that silently grants nothing.
 *
 * Uniform across the three tiers ON PURPOSE, and the precedent is exact: all
 * six accommodation plans grant `EDIT_ACCOMMODATION_INFO` and
 * `PUBLISH_ACCOMMODATIONS`. Editing and publishing your own listing is not a
 * tier differentiator in either catalogue — the cap is.
 *
 * This replaced the previous `entitlements: []`, whose stated reason was that
 * commerce visibility runs through `commerce_listing_subscriptions` + the
 * reconciler rather than the entitlement engine. That remains true of
 * VISIBILITY; what changed (owner decision, 2026-09-01) is that the platform
 * now wants ONE mechanism rather than two, so commerce gets real keys and the
 * commerce routes get real gates.
 *
 * @param input.slug - Plan slug (`gastronomy-basico`, …).
 * @param input.name - Buyer-visible display name; becomes MercadoPago's `reason`.
 * @param input.description - Admin-facing description.
 * @param input.vertical - The commerce vertical this tier belongs to. Supplies
 *   BOTH the cap key and the entitlement pair, so the two can never name
 *   different verticals.
 * @param input.maxListings - Value of that cap for this tier.
 * @param input.sortOrder - Display order within the vertical.
 * @param input.isActive - Whether the tier is sellable AT ALL — a seeded,
 *   priced, subscribable row. Does not by itself decide whether checkout ever
 *   resolves TO it: see `GASTRONOMY_PRO_PLAN`'s doc for why an `isActive` tier
 *   can still be unreachable while another vertical tier stays the default.
 * @param input.monthlyPriceArs - Monthly price in centavos; `0` for a tier that
 *   has not been priced yet, which is also why such a tier ships inactive.
 * @param input.hasTrial - Whether the tier grants a free trial (HOS-590).
 *   Defaults to `false` — a disabled, unpriced tier has no price and is not
 *   sellable, so a trial has nothing to precede. Every `isActive: true` tier
 *   in this file passes `true` here.
 * @param input.trialDays - Trial length in days when `hasTrial` is `true`.
 *   Defaults to `0`.
 * @param input.extraEntitlements - Keys this TIER grants on top of the
 *   vertical's uniform set (HOS-1058). Empty for básico across both
 *   verticals; populated for a tier that earns its dearer name (`-pro`'s
 *   structured carta since HOS-895, `-premium`'s printable PDF since
 *   HOS-1058). This is the one door through which a tier may differ
 *   grantwise from its siblings, and it is deliberately additive: a tier can
 *   add to the vertical's set and can never subtract from it, so the "every
 *   tier of a vertical grants its own pair" invariant above survives whatever
 *   is passed here.
 * @param input.aiChatPerMonth - Monthly AI-chat quota for this tier (HOS-400).
 *   REQUIRED, with no default, on purpose: the limit engine resolves an ABSENT
 *   key as UNLIMITED rather than as zero, so a default would make "nobody
 *   thought about this tier" indistinguishable from "deliberately uncapped".
 *   Pass `0` for a tier that does not grant `AI_CHAT` — it is the belt to the
 *   entitlement gate's braces, and it is what the owner-side check reads as
 *   "feature disabled in this plan".
 * @returns The tier's {@link PlanDefinition}.
 */
function commerceVerticalTier(input: {
    slug: string;
    name: string;
    description: string;
    vertical: CommerceVertical;
    maxListings: number;
    sortOrder: number;
    isActive: boolean;
    monthlyPriceArs: number;
    hasTrial?: boolean;
    trialDays?: number;
    extraEntitlements?: readonly EntitlementKey[];
    aiChatPerMonth: number;
}): PlanDefinition {
    return {
        slug: input.slug,
        name: input.name,
        description: input.description,
        // 'owner' only satisfies the PlanCategory type (D-ISOLATION forbids
        // widening it to add a commerce value). product_domain
        // ('gastronomy' / 'experience') is the real discriminator, stamped by
        // `seedCommercePlan`.
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
        // HOS-1074 — see the "Entitlements" section of this function's doc.
        // Derived from the vertical rather than passed per tier, so all three
        // tiers of a vertical are grantwise identical by construction and a
        // seventh tier cannot be added with an empty set by omission.
        //
        // HOS-1058 appends the tier's own keys AFTER the vertical's, never in
        // place of them. A tier differentiator (the printable PDF ficha) cannot
        // live in `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL` — that map is the
        // floor the gate reads from CODE for every tier at once, so putting a
        // premium-only key there would hand it to básico as well.
        entitlements: [
            ...ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL[input.vertical],
            ...(input.extraEntitlements ?? [])
        ],
        limits: [
            limit(LIMIT_KEY_BY_COMMERCE_VERTICAL[input.vertical], input.maxListings),
            // HOS-400 — the vertical's AI-chat quota. Declared by EVERY tier,
            // including the ones that do not grant AI_CHAT at all, and that is
            // the point: `aiChatPerMonth` is a REQUIRED parameter rather than an
            // optional one defaulting to zero. A tier that omitted the key would
            // not be capped at zero, it would be UNLIMITED — the limit engine
            // resolves an absent key as `-1` through five layers without raising
            // (see `commerce-limits.config.ts`'s header). So básico and pro pass
            // an explicit `0` ("disabled in this plan"), which is a decision
            // somebody made, and a future seventh tier cannot inherit an
            // uncapped chat by forgetting an argument.
            limit(AI_CHAT_LIMIT_KEY_BY_COMMERCE_VERTICAL[input.vertical], input.aiChatPerMonth)
        ]
    };
}

/**
 * The gastronomy catalogue (HOS-688 §6.8, retiered by HOS-818, `-pro`
 * activated by HOS-895 PR2).
 *
 * Built for the full three-tier shape so enabling a tier later is a
 * data-migration rather than a code change. **Two tiers are `isActive` as of
 * HOS-895 PR2** — básico (HOS-818's entry tier) and pro (activated here) —
 * and premium stays reserved for a future step that carries genuinely more.
 *
 * `isActive` here means "seeded, priced, and a valid subscription target" —
 * and since HOS-1119 that is ALSO what makes a tier reachable. A commerce
 * checkout still turns a vertical into a plan slug in exactly one place,
 * `resolveCommercePlanSlug` (`apps/api/src/services/commerce-plan-resolver.ts`),
 * but that resolver now takes the buyer's PICK and validates it against
 * {@link COMMERCE_PLANS_BY_VERTICAL}; {@link DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL}
 * (or the `HOSPEDA_COMMERCE_PLAN_SLUGS` env override) is what a checkout that
 * asks for nothing still gets.
 *
 * Until HOS-1119 the paragraph above said the opposite — commerce had no plan
 * picker and no plan-change route, so a second `isActive` tier changed nothing
 * about which plan a new owner landed on. That is the hole HOS-1119 closed:
 * `gastronomy-pro` had been active, priced and trial-carrying since HOS-895 and
 * nobody could buy it. There is now a tier picker on the checkout and a
 * per-vertical upgrade route
 * (`POST /api/v1/protected/commerce/subscriptions/{vertical}/change-plan`,
 * upgrades only). See `GASTRONOMY_PRO_PLAN`'s own doc.
 *
 * The still-disabled tier carries `monthlyPriceArs: 0` when it has not been
 * priced — shipping it inactive is the same precedent {@link AI_SUPPORT_ADDON}
 * set for a definition whose price is still TBD, and `seedCommercePlan` skips
 * the `billing_prices` row for a tier priced at zero rather than seeding a
 * free one. The disabled premium tier is the exception: it keeps its price
 * and trial, because the row already exists (priced, with a live MercadoPago
 * `preapproval_plan` behind it) in every seeded environment and zeroing the
 * baseline would describe a state no real database is in.
 *
 * Deliberately excluded from {@link ALL_PLANS}, same as every other
 * commerce/partner plan in this file: the accommodation seed loop, the public
 * plan list and the grant-matrix snapshot tests all operate on `ALL_PLANS` and
 * must stay accommodation-only.
 *
 * ---
 *
 * Gastronomy basic tier — **the DEFAULT sellable gastronomy plan** (HOS-818).
 * Still the plan `resolveCommercePlanSlug` resolves by default; see the
 * catalogue doc above for what activating `-pro` did and did not change.
 *
 * One listing for {@link COMMERCE_VERTICAL_MONTHLY_PRICE_ARS} — the exact price,
 * limits and (empty) entitlement set the premium tier carried before it, so the
 * swap changes nothing for anyone paying. What it changes is the NAME the buyer
 * sees, which is the entire point.
 *
 * Carries the same 30-day trial as every accommodation plan
 * ({@link COMMERCE_TRIAL_DAYS}); checkout resolves it through
 * `resolveCheckoutFreeTrialDays`, the same canonical resolver the accommodation
 * paths use (HOS-590).
 */
export const GASTRONOMY_BASICO_PLAN: PlanDefinition = commerceVerticalTier({
    slug: 'gastronomy-basico',
    name: 'Gastronomía Básico',
    description: 'Gastronomy listing plan — one listing per owner (HOS-688, HOS-818).',
    vertical: 'gastronomy',
    maxListings: 1,
    sortOrder: 1,
    isActive: true,
    monthlyPriceArs: COMMERCE_VERTICAL_MONTHLY_PRICE_ARS,
    hasTrial: true,
    trialDays: COMMERCE_TRIAL_DAYS,
    // HOS-400: the AI chat is premium-only in both verticals (owner decision),
    // so básico declares an explicit zero rather than omitting the key.
    aiChatPerMonth: 0
});

/**
 * Gastronomy professional tier — **activated for sale by HOS-895 PR2 (owner
 * decision, 2026-09-03)**, priced at ARS $45.000/mo.
 *
 * Until this change it shipped `isActive: false` / `monthlyPriceArs: 0`,
 * "not enabled yet" — the first thing HOS-895 gave it a reason to exist for
 * was the structured carta below, and the owner decided the same day to stop
 * holding the tier back. See {@link GASTRONOMY_BASICO_PLAN} for the shape.
 *
 * Carries the same 30-day trial as its siblings ({@link COMMERCE_TRIAL_DAYS})
 * — added along with activation, since the two disabled tiers' no-trial
 * defaults only ever described "not sellable yet", not a deliberate choice to
 * sell without one.
 *
 * **Reachable since HOS-1119, and it was not before.** For one release this row
 * was active, priced, trial-carrying and unbuyable: `resolveCommercePlanSlug`
 * (`apps/api/src/services/commerce-plan-resolver.ts`) had exactly one answer per
 * vertical, and no surface could ask for another. That is worth remembering as a
 * shape rather than an anecdote — activating a plan row and making it sellable
 * are two different changes, and the first one produces no error, no log and no
 * failing test on its own (HOS-1118).
 *
 * The resolver is still the ONE place a vertical becomes a plan slug. It now
 * takes the buyer's pick and refuses any slug that is not a tier of the
 * requesting vertical, which is what keeps gastronomy and experiences on
 * separate MercadoPago `preapproval_plan`s. `DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.gastronomy`
 * (still `GASTRONOMY_BASICO_PLAN.slug`, and overridden by
 * `HOSPEDA_COMMERCE_PLAN_SLUGS` on staging/production) remains what a checkout
 * that picks nothing gets — so no environment moved when this became reachable.
 */
export const GASTRONOMY_PRO_PLAN: PlanDefinition = commerceVerticalTier({
    slug: 'gastronomy-pro',
    name: 'Gastronomía Profesional',
    description: 'Gastronomy listing plan — professional tier (HOS-688, activated HOS-895 PR2).',
    vertical: 'gastronomy',
    maxListings: 1,
    sortOrder: 2,
    isActive: true,
    monthlyPriceArs: 4_500_000,
    hasTrial: true,
    trialDays: COMMERCE_TRIAL_DAYS,
    // HOS-895 — the first thing that separates `-pro` from `-basico` by more
    // than its name: the structured carta. Owner decision, `pro` and upwards.
    //
    // HOS-1041 — and the menú del día, which is the second. Owner decision,
    // 2026-09-01, same tier: an operational feature used daily by whoever uses
    // it. A separate key from the carta on purpose (see the enum member).
    //
    // HOS-1042 adds the venue's own events agenda as the third, on the same
    // terms and by the same owner decision: `pro` and upwards, gastronomy only.
    extraEntitlements: [
        EntitlementKey.MANAGE_GASTRONOMY_MENU,
        EntitlementKey.MANAGE_GASTRONOMY_DAILY_SPECIAL,
        EntitlementKey.MANAGE_GASTRONOMY_EVENTS
    ],
    // HOS-400: the AI chat is PREMIUM in both verticals (owner decision), so
    // `-pro` declares an explicit zero. It is the one capability in this file
    // that pro does NOT inherit upward from.
    aiChatPerMonth: 0
});

/**
 * Gastronomy premium tier — **retired from sale by HOS-818, held for a real
 * premium step**.
 *
 * It was the only sellable gastronomy plan until HOS-818 moved that role to
 * {@link GASTRONOMY_BASICO_PLAN}, which is byte-for-byte identical in price,
 * limits and entitlements — so nothing changed for anyone paying, and the name
 * is now free for a tier that genuinely offers more.
 *
 * Kept priced and trial-carrying rather than zeroed out, unlike the never-sold
 * `-pro` tier: the row exists in every seeded environment with a live
 * MercadoPago `preapproval_plan` behind it, and the live subscriptions hang off
 * that plan. Zeroing the baseline would describe a state no real database is in.
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
    description: 'Gastronomy listing plan — one listing per owner (HOS-688, retired by HOS-818).',
    vertical: 'gastronomy',
    maxListings: 1,
    sortOrder: 3,
    isActive: false,
    monthlyPriceArs: COMMERCE_VERTICAL_MONTHLY_PRICE_ARS,
    hasTrial: true,
    trialDays: COMMERCE_TRIAL_DAYS,
    // HOS-1058: the printable PDF ficha. Owner decision, 2026-09-01 — premium,
    // in both verticals.
    //
    // HOS-895 adds the structured carta, which is a `-pro` capability. Repeated
    // here rather than inherited, because these arrays are literal per plan and
    // nothing composes a tier from the one below it: omitting it would mean the
    // dearer plan silently lost a feature `-pro` has.
    //
    // HOS-1045 adds the photo per dish — the FIRST capability this tier holds
    // that `-pro` does not, and what makes premium a step rather than a name
    // (owner decision, 2026-09-01). It sits next to `MANAGE_GASTRONOMY_MENU`
    // by necessity: a dish photo has nowhere to live without dishes, so the
    // two are only ever useful together even though their gates are separate.
    //
    // HOS-1041's menú del día and HOS-1042's venue events agenda are repeated
    // here for the reason the carta is: these arrays are literal per plan, so
    // omitting one would leave the dearer tier missing a feature its cheaper
    // neighbour has.
    extraEntitlements: [
        EntitlementKey.DOWNLOAD_LISTING_PDF,
        EntitlementKey.MANAGE_GASTRONOMY_MENU,
        EntitlementKey.MANAGE_GASTRONOMY_DAILY_SPECIAL,
        EntitlementKey.MANAGE_GASTRONOMY_EVENTS,
        EntitlementKey.MENU_ITEM_PHOTOS,
        // HOS-400 — the AI chat on the public ficha. Owner decision: PREMIUM in
        // both verticals. Note this is `AI_CHAT`, the SAME key the accommodation
        // plans grant, not a gastronomy-specific one: what separates the two is
        // the SUBSCRIPTION the key is read from (SPEC-239 domain isolation) and
        // the per-vertical quota beside it, never a duplicated entitlement.
        // Deliberately NOT in `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL`, which is
        // the floor every tier receives — putting it there would hand the chat
        // to básico and pro too.
        EntitlementKey.AI_CHAT
    ],
    // HOS-400: the only commerce tier of this vertical that carries a nonzero
    // chat quota, because it is the only one that grants the capability.
    aiChatPerMonth: COMMERCE_AI_CHAT_PER_MONTH
});

/**
 * Experience basic tier — **the only sellable experience plan today** (HOS-818).
 * See {@link GASTRONOMY_BASICO_PLAN} for the shape and for why the sellable tier
 * is the basic one.
 *
 * A distinct plan from gastronomy's, not a shared one, and that is worth its
 * own sentence: MercadoPago scopes a free trial to `(payer, preapproval_plan)`,
 * so an owner who spends their trial on gastronomy still receives one when they
 * later add an experience. A single pooled commerce plan would have silently
 * charged them from day one while the page promised a trial.
 */
export const EXPERIENCE_BASICO_PLAN: PlanDefinition = commerceVerticalTier({
    slug: 'experience-basico',
    name: 'Experiencias Básico',
    description: 'Experience listing plan — one listing per owner (HOS-688, HOS-818).',
    vertical: 'experience',
    maxListings: 1,
    sortOrder: 1,
    isActive: true,
    monthlyPriceArs: COMMERCE_VERTICAL_MONTHLY_PRICE_ARS,
    hasTrial: true,
    trialDays: COMMERCE_TRIAL_DAYS,
    // HOS-400: the AI chat is premium-only in both verticals (owner decision),
    // so básico declares an explicit zero rather than omitting the key.
    aiChatPerMonth: 0
});

/**
 * Experience professional tier. See {@link GASTRONOMY_BASICO_PLAN}.
 *
 * **Still `isActive: false` and unpriced, on purpose, and neither HOS-1049 nor
 * HOS-1057 changed that.** Granting a tier a capability and putting that tier
 * on sale are two different decisions — the shape HOS-1118 names — and it is
 * the same two-step gastronomy took: HOS-895 PR1 granted
 * `MANAGE_GASTRONOMY_MENU` to a `-pro` nobody could buy, and PR2 activated and
 * priced it. Until the equivalent decision is taken for experiences, no
 * subscriber can hold either of this tier's keys and the gates that read them
 * refuse everyone rather than drawing a live tier line — exactly as
 * `DOWNLOAD_LISTING_PDF` reaches nobody on the retired premium tiers. The
 * presentation page says so in as many words rather than promising a feature
 * that cannot be bought.
 */
export const EXPERIENCE_PRO_PLAN: PlanDefinition = commerceVerticalTier({
    slug: 'experience-pro',
    name: 'Experiencias Profesional',
    description: 'Experience listing plan — professional tier (not enabled yet, HOS-688).',
    vertical: 'experience',
    maxListings: 1,
    sortOrder: 2,
    isActive: false,
    monthlyPriceArs: 0,
    // The two things that separate `-pro` from `-basico` by more than its
    // name, both owner decisions of 2026-09-01, both `pro` and upwards:
    // HOS-1049 — how to GET to the meeting point (the instructions and the map
    // that draws it); the meeting point itself stays on `-basico`.
    // HOS-1057 — the certificate a provider issues to whoever did the
    // experience.
    extraEntitlements: [
        EntitlementKey.MANAGE_EXPERIENCE_DIRECTIONS,
        EntitlementKey.ISSUE_EXPERIENCE_CERTIFICATE
    ],
    // HOS-400: the AI chat is PREMIUM in both verticals (owner decision), so
    // `-pro` declares an explicit zero. It is the one capability in this file
    // that pro does NOT inherit upward from.
    aiChatPerMonth: 0
});

/**
 * Experience premium tier — **retired from sale by HOS-818**, on the same terms
 * and for the same reasons as {@link GASTRONOMY_PREMIUM_PLAN}: the sellable role
 * moved to {@link EXPERIENCE_BASICO_PLAN}, and this definition stays priced
 * because its row and its MercadoPago `preapproval_plan` both still exist.
 */
export const EXPERIENCE_PREMIUM_PLAN: PlanDefinition = commerceVerticalTier({
    slug: 'experience-premium',
    name: 'Experiencias Premium',
    description: 'Experience listing plan — one listing per owner (HOS-688, retired by HOS-818).',
    vertical: 'experience',
    maxListings: 1,
    sortOrder: 3,
    isActive: false,
    monthlyPriceArs: COMMERCE_VERTICAL_MONTHLY_PRICE_ARS,
    hasTrial: true,
    trialDays: COMMERCE_TRIAL_DAYS,
    // HOS-1058 — R-1: the two verticals are separate domains, so the same
    // capability is granted to each vertical's premium plan on its own. There
    // is no "commerce" plan to grant it once.
    //
    // HOS-1049 and HOS-1057 each add a `-pro` capability. Repeated here rather
    // than inherited, because these arrays are literal per plan and nothing
    // composes a tier out of the one below it: omitting either would mean the
    // dearer plan silently lost a feature `-pro` has. Same reasoning as
    // {@link GASTRONOMY_PREMIUM_PLAN}.
    extraEntitlements: [
        EntitlementKey.DOWNLOAD_LISTING_PDF,
        EntitlementKey.MANAGE_EXPERIENCE_DIRECTIONS,
        EntitlementKey.ISSUE_EXPERIENCE_CERTIFICATE,
        // HOS-400 — see the twin comment on GASTRONOMY_PREMIUM_PLAN. Same key,
        // different subscription domain; the isolation comes from the domain and
        // the per-vertical quota, not from a duplicated entitlement.
        EntitlementKey.AI_CHAT
    ],
    // HOS-400: the only commerce tier of this vertical that carries a nonzero
    // chat quota, because it is the only one that grants the capability.
    aiChatPerMonth: COMMERCE_AI_CHAT_PER_MONTH
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
    // HOS-818: the sellable tier is now the BASIC one in both verticals. Note
    // that flipping this default does NOT move an already-deployed environment:
    // `HOSPEDA_COMMERCE_PLAN_SLUG_BY_VERTICAL` is set explicitly on staging and
    // production, and an explicit env value wins over this default. That variable
    // has to be updated in Coolify for the rename to take effect there.
    gastronomy: GASTRONOMY_BASICO_PLAN.slug,
    experience: EXPERIENCE_BASICO_PLAN.slug
} as const;

/**
 * Every tier of each commerce vertical, in display order (HOS-1119).
 *
 * {@link DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL} above answers "which ONE plan
 * does a vertical fall back to"; this answers the question HOS-1119 needed and
 * nothing could: "which plans is a vertical ALLOWED to be on at all". The two
 * are complementary, not alternatives — the default is still exactly what a
 * checkout that asks for nothing gets.
 *
 * Built from {@link ALL_GASTRONOMY_PLANS} / {@link ALL_EXPERIENCE_PLANS} rather
 * than re-listing the tiers, so a seventh tier added to either array is
 * selectable by construction and cannot be forgotten here.
 */
export const COMMERCE_PLANS_BY_VERTICAL: Readonly<
    Record<CommerceVertical, readonly PlanDefinition[]>
> = {
    gastronomy: ALL_GASTRONOMY_PLANS,
    experience: ALL_EXPERIENCE_PLANS
} as const;

/**
 * Finds the commerce plan definition a vertical knows by that slug (HOS-1119).
 *
 * **This is a MEMBERSHIP test, not a sellability test, and the split is the
 * point.** It answers only "does this slug name a tier of this vertical" — a
 * structural fact fixed in this catalogue that no operator can change at
 * runtime. Whether that tier is currently *sellable* is a `billing_plans.active`
 * question, read from the DATABASE at checkout time, exactly as
 * `loadVerticalBaseLimit` reads the cap from the database rather than from this
 * file: activating or retiring a tier must take effect without a deploy.
 *
 * Keeping membership in code is what preserves HOS-688 AC-35's real invariant:
 * a gastronomy checkout can never be pointed at an experience plan, and so never
 * at the other vertical's MercadoPago `preapproval_plan`. That is the property
 * the per-vertical free trial rests on, and it is now enforced by a lookup
 * instead of by there having been only one possible answer.
 *
 * @param input.vertical - The vertical the request belongs to.
 * @param input.slug - The plan slug the caller asked for.
 * @returns The matching {@link PlanDefinition}, or `undefined` when the slug
 *   names no tier of that vertical — including when it names a tier of the OTHER
 *   vertical, which is the case that matters.
 */
export function findCommercePlanForVertical(input: {
    vertical: CommerceVertical;
    slug: string;
}): PlanDefinition | undefined {
    return COMMERCE_PLANS_BY_VERTICAL[input.vertical].find((plan) => plan.slug === input.slug);
}

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
    // Empty, same as every commerce-vertical tier: partner visibility is
    // driven by the subscription status and the partner row's own
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
 * as {@link PARTNER_LISTING_PLAN} and every commerce-vertical plan in this
 * file: the accommodation seed loop, the public plan list, and the
 * grant-matrix snapshot tests all operate on `ALL_PLANS` and must never see
 * this plan.
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
