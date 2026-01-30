import type { EntitlementKey } from './entitlement.types.js';

/**
 * Limit key identifiers used across the billing system.
 * These keys map to numeric limits that vary by plan.
 */
export enum LimitKey {
    MAX_ACCOMMODATIONS = 'max_accommodations',
    MAX_PHOTOS_PER_ACCOMMODATION = 'max_photos_per_accommodation',
    MAX_ACTIVE_PROMOTIONS = 'max_active_promotions',
    MAX_FAVORITES = 'max_favorites',
    MAX_PROPERTIES = 'max_properties',
    MAX_STAFF_ACCOUNTS = 'max_staff_accounts'
}

/**
 * Plan category indicating the target user type
 */
export type PlanCategory = 'owner' | 'complex' | 'tourist';

/**
 * Limit definition with a numeric value
 */
export interface LimitDefinition {
    /** The limit key */
    key: LimitKey;
    /** Numeric value for this limit (-1 means unlimited) */
    value: number;
    /** Human-readable name */
    name: string;
    /** Description of the limit */
    description: string;
}

/**
 * Complete plan definition including metadata, pricing, entitlements, and limits
 */
export interface PlanDefinition {
    /** Unique plan identifier (slug) */
    slug: string;
    /** Display name */
    name: string;
    /** Plan description */
    description: string;
    /** Target user category */
    category: PlanCategory;
    /** Monthly price in ARS cents (0 for free plans) */
    monthlyPriceArs: number;
    /** Annual price in ARS cents (0 for free, null if no annual option) */
    annualPriceArs: number | null;
    /** USD reference price for display purposes */
    monthlyPriceUsdRef: number;
    /** Whether this plan has a trial period */
    hasTrial: boolean;
    /** Trial duration in days (0 if no trial) */
    trialDays: number;
    /** Whether this is the default plan for its category */
    isDefault: boolean;
    /** Sort order for display */
    sortOrder: number;
    /** Entitlement keys included in this plan */
    entitlements: EntitlementKey[];
    /** Limits for this plan */
    limits: LimitDefinition[];
    /** Whether the plan is currently available for purchase */
    isActive: boolean;
}
