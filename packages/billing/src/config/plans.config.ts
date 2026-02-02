import { COMPLEX_TRIAL_DAYS, OWNER_TRIAL_DAYS } from '../constants/billing.constants.js';
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

// ─── OWNER PLANS ───────────────────────────────────────────────

export const OWNER_BASICO_PLAN: PlanDefinition = {
    slug: 'owner-basico',
    name: 'Basico',
    description: 'Plan basico para propietarios individuales. Ideal para comenzar.',
    category: 'owner',
    monthlyPriceArs: 1500000, // ARS $15,000 (in cents)
    annualPriceArs: 15000000, // ARS $150,000/year (2 months free)
    monthlyPriceUsdRef: 15,
    hasTrial: true,
    trialDays: OWNER_TRIAL_DAYS,
    isDefault: true,
    sortOrder: 1,
    isActive: true,
    entitlements: [
        EntitlementKey.PUBLISH_ACCOMMODATIONS,
        EntitlementKey.EDIT_ACCOMMODATION_INFO,
        EntitlementKey.VIEW_BASIC_STATS,
        EntitlementKey.RESPOND_REVIEWS,
        EntitlementKey.CAN_USE_CALENDAR,
        EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY
    ],
    limits: [
        limit(LimitKey.MAX_ACCOMMODATIONS, 1),
        limit(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 5),
        limit(LimitKey.MAX_ACTIVE_PROMOTIONS, 0)
    ]
};

export const OWNER_PRO_PLAN: PlanDefinition = {
    slug: 'owner-pro',
    name: 'Profesional',
    description: 'Plan profesional con estadisticas avanzadas y soporte prioritario.',
    category: 'owner',
    monthlyPriceArs: 3500000, // ARS $35,000
    annualPriceArs: 35000000, // ARS $350,000/year
    monthlyPriceUsdRef: 35,
    hasTrial: true,
    trialDays: OWNER_TRIAL_DAYS,
    isDefault: false,
    sortOrder: 2,
    isActive: true,
    entitlements: [
        EntitlementKey.PUBLISH_ACCOMMODATIONS,
        EntitlementKey.EDIT_ACCOMMODATION_INFO,
        EntitlementKey.VIEW_BASIC_STATS,
        EntitlementKey.VIEW_ADVANCED_STATS,
        EntitlementKey.RESPOND_REVIEWS,
        EntitlementKey.PRIORITY_SUPPORT,
        EntitlementKey.FEATURED_LISTING,
        EntitlementKey.CREATE_PROMOTIONS,
        EntitlementKey.CAN_USE_RICH_DESCRIPTION,
        EntitlementKey.CAN_EMBED_VIDEO,
        EntitlementKey.CAN_USE_CALENDAR,
        EntitlementKey.CAN_SYNC_EXTERNAL_CALENDAR,
        EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY,
        EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT
    ],
    limits: [
        limit(LimitKey.MAX_ACCOMMODATIONS, 3),
        limit(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 15),
        limit(LimitKey.MAX_ACTIVE_PROMOTIONS, 3)
    ]
};

export const OWNER_PREMIUM_PLAN: PlanDefinition = {
    slug: 'owner-premium',
    name: 'Premium',
    description: 'Plan premium con todas las funcionalidades, gestor dedicado y API.',
    category: 'owner',
    monthlyPriceArs: 7500000, // ARS $75,000
    annualPriceArs: 75000000, // ARS $750,000/year
    monthlyPriceUsdRef: 75,
    hasTrial: true,
    trialDays: OWNER_TRIAL_DAYS,
    isDefault: false,
    sortOrder: 3,
    isActive: true,
    entitlements: [
        EntitlementKey.PUBLISH_ACCOMMODATIONS,
        EntitlementKey.EDIT_ACCOMMODATION_INFO,
        EntitlementKey.VIEW_BASIC_STATS,
        EntitlementKey.VIEW_ADVANCED_STATS,
        EntitlementKey.RESPOND_REVIEWS,
        EntitlementKey.PRIORITY_SUPPORT,
        EntitlementKey.FEATURED_LISTING,
        EntitlementKey.CUSTOM_BRANDING,
        EntitlementKey.API_ACCESS,
        EntitlementKey.DEDICATED_MANAGER,
        EntitlementKey.CREATE_PROMOTIONS,
        EntitlementKey.SOCIAL_MEDIA_INTEGRATION,
        EntitlementKey.CAN_USE_RICH_DESCRIPTION,
        EntitlementKey.CAN_EMBED_VIDEO,
        EntitlementKey.CAN_USE_CALENDAR,
        EntitlementKey.CAN_SYNC_EXTERNAL_CALENDAR,
        EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY,
        EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT,
        EntitlementKey.HAS_VERIFICATION_BADGE
    ],
    limits: [
        limit(LimitKey.MAX_ACCOMMODATIONS, 10),
        limit(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 30),
        limit(LimitKey.MAX_ACTIVE_PROMOTIONS, -1) // unlimited
    ]
};

// ─── COMPLEX PLANS ─────────────────────────────────────────────

export const COMPLEX_BASICO_PLAN: PlanDefinition = {
    slug: 'complex-basico',
    name: 'Complejo Basico',
    description: 'Plan basico para complejos y hoteles. Gestion multi-propiedad.',
    category: 'complex',
    monthlyPriceArs: 5000000, // ARS $50,000
    annualPriceArs: 50000000, // ARS $500,000/year
    monthlyPriceUsdRef: 50,
    hasTrial: true,
    trialDays: COMPLEX_TRIAL_DAYS,
    isDefault: true,
    sortOrder: 1,
    isActive: true,
    entitlements: [
        EntitlementKey.PUBLISH_ACCOMMODATIONS,
        EntitlementKey.EDIT_ACCOMMODATION_INFO,
        EntitlementKey.VIEW_BASIC_STATS,
        EntitlementKey.RESPOND_REVIEWS,
        EntitlementKey.MULTI_PROPERTY_MANAGEMENT,
        EntitlementKey.CAN_USE_CALENDAR,
        EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY
    ],
    limits: [
        limit(LimitKey.MAX_PROPERTIES, 3),
        limit(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 10),
        limit(LimitKey.MAX_STAFF_ACCOUNTS, 2),
        limit(LimitKey.MAX_ACTIVE_PROMOTIONS, 0)
    ]
};

export const COMPLEX_PRO_PLAN: PlanDefinition = {
    slug: 'complex-pro',
    name: 'Complejo Profesional',
    description: 'Plan profesional para complejos con analiticas consolidadas.',
    category: 'complex',
    monthlyPriceArs: 10000000, // ARS $100,000
    annualPriceArs: 100000000, // ARS $1,000,000/year
    monthlyPriceUsdRef: 100,
    hasTrial: true,
    trialDays: COMPLEX_TRIAL_DAYS,
    isDefault: false,
    sortOrder: 2,
    isActive: true,
    entitlements: [
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
        EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT
    ],
    limits: [
        limit(LimitKey.MAX_PROPERTIES, 10),
        limit(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 20),
        limit(LimitKey.MAX_STAFF_ACCOUNTS, 5),
        limit(LimitKey.MAX_ACTIVE_PROMOTIONS, 5)
    ]
};

export const COMPLEX_PREMIUM_PLAN: PlanDefinition = {
    slug: 'complex-premium',
    name: 'Complejo Premium',
    description: 'Plan premium para grandes complejos con todas las funcionalidades.',
    category: 'complex',
    monthlyPriceArs: 20000000, // ARS $200,000
    annualPriceArs: 200000000, // ARS $2,000,000/year
    monthlyPriceUsdRef: 200,
    hasTrial: true,
    trialDays: COMPLEX_TRIAL_DAYS,
    isDefault: false,
    sortOrder: 3,
    isActive: true,
    entitlements: [
        EntitlementKey.PUBLISH_ACCOMMODATIONS,
        EntitlementKey.EDIT_ACCOMMODATION_INFO,
        EntitlementKey.VIEW_BASIC_STATS,
        EntitlementKey.VIEW_ADVANCED_STATS,
        EntitlementKey.RESPOND_REVIEWS,
        EntitlementKey.PRIORITY_SUPPORT,
        EntitlementKey.FEATURED_LISTING,
        EntitlementKey.CUSTOM_BRANDING,
        EntitlementKey.API_ACCESS,
        EntitlementKey.DEDICATED_MANAGER,
        EntitlementKey.MULTI_PROPERTY_MANAGEMENT,
        EntitlementKey.CONSOLIDATED_ANALYTICS,
        EntitlementKey.CENTRALIZED_BOOKING,
        EntitlementKey.STAFF_MANAGEMENT,
        EntitlementKey.WHITE_LABEL,
        EntitlementKey.MULTI_CHANNEL_INTEGRATION,
        EntitlementKey.CREATE_PROMOTIONS,
        EntitlementKey.SOCIAL_MEDIA_INTEGRATION,
        EntitlementKey.CAN_USE_RICH_DESCRIPTION,
        EntitlementKey.CAN_EMBED_VIDEO,
        EntitlementKey.CAN_USE_CALENDAR,
        EntitlementKey.CAN_SYNC_EXTERNAL_CALENDAR,
        EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY,
        EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT,
        EntitlementKey.HAS_VERIFICATION_BADGE
    ],
    limits: [
        limit(LimitKey.MAX_PROPERTIES, -1), // unlimited
        limit(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 50),
        limit(LimitKey.MAX_STAFF_ACCOUNTS, -1), // unlimited
        limit(LimitKey.MAX_ACTIVE_PROMOTIONS, -1) // unlimited
    ]
};

// ─── TOURIST PLANS ─────────────────────────────────────────────

export const TOURIST_FREE_PLAN: PlanDefinition = {
    slug: 'tourist-free',
    name: 'Gratis',
    description: 'Plan gratuito para turistas. Funcionalidades basicas incluidas.',
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
        EntitlementKey.READ_REVIEWS,
        EntitlementKey.CAN_VIEW_RECOMMENDATIONS
    ],
    limits: [limit(LimitKey.MAX_FAVORITES, 3)]
};

export const TOURIST_PLUS_PLAN: PlanDefinition = {
    slug: 'tourist-plus',
    name: 'Plus',
    description: 'Plan Plus para turistas frecuentes. Sin publicidad y alertas de precio.',
    category: 'tourist',
    monthlyPriceArs: 500000, // ARS $5,000
    annualPriceArs: 5000000, // ARS $50,000/year
    monthlyPriceUsdRef: 5,
    hasTrial: false,
    trialDays: 0,
    isDefault: false,
    sortOrder: 2,
    isActive: true,
    entitlements: [
        EntitlementKey.SAVE_FAVORITES,
        EntitlementKey.WRITE_REVIEWS,
        EntitlementKey.READ_REVIEWS,
        EntitlementKey.AD_FREE,
        EntitlementKey.PRICE_ALERTS,
        EntitlementKey.EARLY_ACCESS_EVENTS,
        EntitlementKey.EXCLUSIVE_DEALS,
        EntitlementKey.CAN_COMPARE_ACCOMMODATIONS,
        EntitlementKey.CAN_ATTACH_REVIEW_PHOTOS,
        EntitlementKey.CAN_VIEW_SEARCH_HISTORY,
        EntitlementKey.CAN_VIEW_RECOMMENDATIONS,
        EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY
    ],
    limits: [limit(LimitKey.MAX_FAVORITES, 20)]
};

export const TOURIST_VIP_PLAN: PlanDefinition = {
    slug: 'tourist-vip',
    name: 'VIP',
    description: 'Plan VIP para turistas exigentes. Todas las funcionalidades premium.',
    category: 'tourist',
    monthlyPriceArs: 1500000, // ARS $15,000
    annualPriceArs: 15000000, // ARS $150,000/year
    monthlyPriceUsdRef: 15,
    hasTrial: false,
    trialDays: 0,
    isDefault: false,
    sortOrder: 3,
    isActive: true,
    entitlements: [
        EntitlementKey.SAVE_FAVORITES,
        EntitlementKey.WRITE_REVIEWS,
        EntitlementKey.READ_REVIEWS,
        EntitlementKey.AD_FREE,
        EntitlementKey.PRICE_ALERTS,
        EntitlementKey.EARLY_ACCESS_EVENTS,
        EntitlementKey.EXCLUSIVE_DEALS,
        EntitlementKey.VIP_SUPPORT,
        EntitlementKey.CONCIERGE_SERVICE,
        EntitlementKey.AIRPORT_TRANSFERS,
        EntitlementKey.VIP_PROMOTIONS_ACCESS,
        EntitlementKey.CAN_COMPARE_ACCOMMODATIONS,
        EntitlementKey.CAN_ATTACH_REVIEW_PHOTOS,
        EntitlementKey.CAN_VIEW_SEARCH_HISTORY,
        EntitlementKey.CAN_VIEW_RECOMMENDATIONS,
        EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY,
        EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT
    ],
    limits: [
        limit(LimitKey.MAX_FAVORITES, -1) // unlimited
    ]
};

// ─── ALL PLANS ─────────────────────────────────────────────────

/** All available plans in the system */
export const ALL_PLANS: PlanDefinition[] = [
    OWNER_BASICO_PLAN,
    OWNER_PRO_PLAN,
    OWNER_PREMIUM_PLAN,
    COMPLEX_BASICO_PLAN,
    COMPLEX_PRO_PLAN,
    COMPLEX_PREMIUM_PLAN,
    TOURIST_FREE_PLAN,
    TOURIST_PLUS_PLAN,
    TOURIST_VIP_PLAN
];

/** Plans grouped by category */
export const PLANS_BY_CATEGORY = {
    owner: [OWNER_BASICO_PLAN, OWNER_PRO_PLAN, OWNER_PREMIUM_PLAN],
    complex: [COMPLEX_BASICO_PLAN, COMPLEX_PRO_PLAN, COMPLEX_PREMIUM_PLAN],
    tourist: [TOURIST_FREE_PLAN, TOURIST_PLUS_PLAN, TOURIST_VIP_PLAN]
} as const;

/**
 * Get a plan by its slug
 */
export function getPlanBySlug(slug: string): PlanDefinition | undefined {
    return ALL_PLANS.find((plan) => plan.slug === slug);
}

/**
 * Get the default plan for a category
 */
export function getDefaultPlan(category: PlanDefinition['category']): PlanDefinition {
    const plan = ALL_PLANS.find((p) => p.category === category && p.isDefault);
    if (!plan) {
        throw new Error(`No default plan found for category: ${category}`);
    }
    return plan;
}
