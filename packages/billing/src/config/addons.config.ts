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
    sortOrder: 1
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
    sortOrder: 2
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
    priceArs: 1000000, // ARS $10,000/month
    annualPriceArs: 9600000, // ARS $96,000/year (20% annual discount)
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

// ─── ALL ADD-ONS ───────────────────────────────────────────────

/** All available add-ons in the system */
export const ALL_ADDONS: AddonDefinition[] = [
    VISIBILITY_BOOST_ADDON,
    VISIBILITY_BOOST_30D_ADDON,
    EXTRA_PHOTOS_ADDON,
    EXTRA_ACCOMMODATIONS_ADDON,
    EXTRA_PROPERTIES_ADDON
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
