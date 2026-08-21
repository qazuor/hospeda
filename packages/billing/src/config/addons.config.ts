import type { AddonDefinition } from '../types/addon.types.js';
import { EntitlementKey } from '../types/entitlement.types.js';
import { LimitKey } from '../types/plan.types.js';

// ─── ONE-TIME ADD-ONS ──────────────────────────────────────────

export const VISIBILITY_BOOST_ADDON: AddonDefinition = {
    slug: 'visibility-boost-7d',
    name: 'Visibility Boost (7 days)',
    description: 'Your accommodation appears featured in search results for 7 days.',
    billingType: 'one_time',
    priceArs: 500000, // ARS $5,000
    annualPriceArs: null, // One-time purchase
    durationDays: 7,
    affectsLimitKey: null,
    limitIncrease: null,
    grantsEntitlement: EntitlementKey.FEATURED_LISTING,
    targetCategories: ['owner', 'complex'],
    isActive: true,
    sortOrder: 1,
    requiresAccommodationTarget: true
};

export const VISIBILITY_BOOST_30D_ADDON: AddonDefinition = {
    slug: 'visibility-boost-30d',
    name: 'Visibility Boost (30 days)',
    description: 'Your accommodation appears featured in search results for 30 days.',
    billingType: 'one_time',
    priceArs: 1500000, // ARS $15,000
    annualPriceArs: null, // One-time purchase
    durationDays: 30,
    affectsLimitKey: null,
    limitIncrease: null,
    grantsEntitlement: EntitlementKey.FEATURED_LISTING,
    targetCategories: ['owner', 'complex'],
    isActive: true,
    sortOrder: 2,
    requiresAccommodationTarget: true
};

// ─── RECURRING ADD-ONS ─────────────────────────────────────────

export const EXTRA_PHOTOS_ADDON: AddonDefinition = {
    slug: 'extra-photos-20',
    name: 'Extra Photos Pack (+20 photos)',
    description: 'Adds 20 additional photos to each accommodation. Renews monthly.',
    billingType: 'recurring',
    priceArs: 500000, // ARS $5,000/month
    annualPriceArs: 4800000, // ARS $48,000/year (20% annual discount)
    durationDays: null,
    affectsLimitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
    limitIncrease: 20,
    grantsEntitlement: null,
    targetCategories: ['owner', 'complex'],
    isActive: true,
    sortOrder: 3
};

export const EXTRA_ACCOMMODATIONS_ADDON: AddonDefinition = {
    slug: 'extra-accommodations-5',
    name: 'Extra Accommodations Pack (+5)',
    description: 'Adds 5 additional accommodations to your plan. Renews monthly.',
    billingType: 'recurring',
    priceArs: 1300000, // ARS $13,000/month — HOS-301 D1
    annualPriceArs: 13000000, // ARS $130,000/year (ten months, matching the owner plans) — HOS-301 D1
    durationDays: null,
    affectsLimitKey: LimitKey.MAX_ACCOMMODATIONS,
    limitIncrease: 5,
    grantsEntitlement: null,
    targetCategories: ['owner'],
    isActive: true,
    sortOrder: 4
};

export const EXTRA_PROPERTIES_ADDON: AddonDefinition = {
    slug: 'extra-properties-5',
    name: 'Extra Properties Pack (+5)',
    description: 'Adds 5 additional properties to your complex. Renews monthly.',
    billingType: 'recurring',
    priceArs: 2000000, // ARS $20,000/month
    annualPriceArs: 19200000, // ARS $192,000/year (20% annual discount)
    durationDays: null,
    affectsLimitKey: LimitKey.MAX_PROPERTIES,
    limitIncrease: 5,
    grantsEntitlement: null,
    targetCategories: ['complex'],
    isActive: true,
    sortOrder: 5
};

export const AI_SUPPORT_ADDON: AddonDefinition = {
    slug: 'ai-support-monthly',
    name: 'AI Support (monthly)',
    description:
        'Unlocks AI-powered support tools for hosts, including smart reply suggestions and automated guest FAQ handling. Renews monthly.',
    billingType: 'recurring',
    // Placeholder pricing/quota — the ai_support FEATURE route is deferred to a
    // future spec (SPEC-211 §AC-4.2). Until that spec lands with final pricing,
    // the addon ships INACTIVE so it never surfaces in the purchasable catalog:
    // an active addon at a TBD price would grant AI_SUPPORT for a feature that
    // does not exist yet (host pays, receives nothing). Flip isActive to true in
    // the ai_support feature spec once price/quota are confirmed by the owner.
    priceArs: 800000, // ARS $8,000/month — TBD: owner to confirm final price at implementation
    annualPriceArs: 7680000, // ARS $76,800/year (20% annual discount) — TBD: owner to confirm at implementation
    durationDays: null,
    affectsLimitKey: LimitKey.MAX_AI_SUPPORT_PER_MONTH,
    limitIncrease: 100, // TBD: owner to confirm the monthly AI interaction quota at implementation
    grantsEntitlement: EntitlementKey.AI_SUPPORT,
    targetCategories: ['owner', 'complex'],
    isActive: false,
    sortOrder: 6
};

/**
 * Extra-listing add-ons, one per commerce vertical (HOS-688 §6.8).
 *
 * Calqued on {@link EXTRA_ACCOMMODATIONS_ADDON}: recurring, no entitlement, an
 * `affectsLimitKey` pointing at the vertical's own cap. Two definitions rather
 * than one pooled add-on because an `AddonDefinition` carries exactly one
 * `affectsLimitKey` — the model already implies the split, and a shared add-on
 * could not express "raise my gastronomy cap and leave my experience cap
 * alone".
 *
 * `limitIncrease: 1`, not 5: a commerce plan sells ONE listing, so one listing
 * is the unit an owner buys more of.
 *
 * **Price** mirrors the vertical plan's own ARS $15.000 — a second listing
 * costs what the first one does. That is DERIVED from the plan price rather
 * than separately decided, and like every price in this package it is a
 * `'commercial'` field: the database wins, so an admin-UI override stands
 * without a deploy.
 *
 * Each add-on must also appear in `ADDON_SLUG_BY_LIMIT_KEY`
 * (`apps/web/src/lib/billing/plan-usage-config.ts`), or it is purchasable and
 * grants the cap increase while never being linked from the at-cap row anyone
 * would buy it from.
 */
export const EXTRA_GASTRONOMIES_ADDON: AddonDefinition = {
    slug: 'extra-gastronomies-1',
    name: 'Extra Gastronomy Listing (+1)',
    description: 'Adds 1 additional gastronomy listing to your plan. Renews monthly.',
    billingType: 'recurring',
    priceArs: 1500000, // ARS $15,000/month — same as the gastronomy plan itself
    annualPriceArs: 15000000, // ARS $150,000/year (ten months, the rule every plan here follows)
    durationDays: null,
    affectsLimitKey: LimitKey.MAX_GASTRONOMIES,
    limitIncrease: 1,
    grantsEntitlement: null,
    // 'owner' for the same reason the commerce plans use it: PlanCategory has no
    // commerce member and product_domain is the real discriminator.
    targetCategories: ['owner'],
    isActive: true,
    sortOrder: 7
};

/** Experience-side twin of {@link EXTRA_GASTRONOMIES_ADDON}. */
export const EXTRA_EXPERIENCES_ADDON: AddonDefinition = {
    slug: 'extra-experiences-1',
    name: 'Extra Experience Listing (+1)',
    description: 'Adds 1 additional experience listing to your plan. Renews monthly.',
    billingType: 'recurring',
    priceArs: 1500000, // ARS $15,000/month — same as the experience plan itself
    annualPriceArs: 15000000, // ARS $150,000/year (ten months, the rule every plan here follows)
    durationDays: null,
    affectsLimitKey: LimitKey.MAX_EXPERIENCES,
    limitIncrease: 1,
    grantsEntitlement: null,
    targetCategories: ['owner'],
    isActive: true,
    sortOrder: 8
};

// ─── ALL ADD-ONS ───────────────────────────────────────────────

/** All available add-ons in the system */
export const ALL_ADDONS: AddonDefinition[] = [
    VISIBILITY_BOOST_ADDON,
    VISIBILITY_BOOST_30D_ADDON,
    EXTRA_PHOTOS_ADDON,
    EXTRA_ACCOMMODATIONS_ADDON,
    EXTRA_PROPERTIES_ADDON,
    AI_SUPPORT_ADDON,
    EXTRA_GASTRONOMIES_ADDON,
    EXTRA_EXPERIENCES_ADDON
];

/**
 * Retrieves an add-on definition by its unique slug identifier.
 *
 * @param slug - The unique slug of the add-on to find (e.g. 'visibility-boost-7d')
 * @returns The matching AddonDefinition, or undefined if not found
 *
 * @example
 * ```ts
 * const addon = getAddonBySlug('visibility-boost-7d');
 * if (addon) {
 *     console.log(`Found: ${addon.name} - ${addon.priceArs / 100} ARS`);
 * }
 * ```
 */
export function getAddonBySlug(slug: string): AddonDefinition | undefined {
    return ALL_ADDONS.find((addon) => addon.slug === slug);
}
