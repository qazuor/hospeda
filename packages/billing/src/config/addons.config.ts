import type { AddonDefinition } from '../types/addon.types.js';
import { EntitlementKey } from '../types/entitlement.types.js';
import { LimitKey } from '../types/plan.types.js';

// ─── ONE-TIME ADD-ONS ──────────────────────────────────────────

export const VISIBILITY_BOOST_ADDON: AddonDefinition = {
    slug: 'visibility-boost-7d',
    name: 'Boost de visibilidad (7 dias)',
    description: 'Tu alojamiento aparece destacado en los resultados de busqueda durante 7 dias.',
    billingType: 'one_time',
    priceArs: 500000, // ARS $5,000
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
    name: 'Boost de visibilidad (30 dias)',
    description: 'Tu alojamiento aparece destacado en los resultados de busqueda durante 30 dias.',
    billingType: 'one_time',
    priceArs: 1500000, // ARS $15,000
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
    name: 'Pack fotos extra (+20 fotos)',
    description: 'Agrega 20 fotos adicionales a cada alojamiento. Se renueva mensualmente.',
    billingType: 'recurring',
    priceArs: 500000, // ARS $5,000/month
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
    name: 'Pack alojamientos extra (+5)',
    description: 'Agrega 5 alojamientos adicionales a tu plan. Se renueva mensualmente.',
    billingType: 'recurring',
    priceArs: 1000000, // ARS $10,000/month
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
    name: 'Pack propiedades extra (+5)',
    description: 'Agrega 5 propiedades adicionales a tu complejo. Se renueva mensualmente.',
    billingType: 'recurring',
    priceArs: 2000000, // ARS $20,000/month
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
 * Get an add-on by its slug
 */
export function getAddonBySlug(slug: string): AddonDefinition | undefined {
    return ALL_ADDONS.find((addon) => addon.slug === slug);
}
