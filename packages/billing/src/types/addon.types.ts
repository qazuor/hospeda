import type { EntitlementKey } from './entitlement.types.js';
import type { LimitKey, PlanCategory } from './plan.types.js';

/**
 * Add-on billing type
 */
export type AddonBillingType = 'one_time' | 'recurring';

/**
 * Complete add-on definition
 */
export interface AddonDefinition {
    /** Unique addon identifier (slug) */
    slug: string;
    /** Display name */
    name: string;
    /** Add-on description */
    description: string;
    /** Billing type */
    billingType: AddonBillingType;
    /** Monthly price in ARS cents */
    priceArs: number;
    /** Annual price in ARS cents (null for one-time add-ons) */
    annualPriceArs: number | null;
    /** Duration in days (for one-time add-ons, null for recurring) */
    durationDays: number | null;
    /** Limit key this add-on affects (if any) */
    affectsLimitKey: LimitKey | null;
    /** How much to add to the limit */
    limitIncrease: number | null;
    /** Entitlement key this add-on grants (if any) */
    grantsEntitlement: EntitlementKey | null;
    /** Target plan categories that can purchase this add-on */
    targetCategories: PlanCategory[];
    /** Whether the add-on is currently available */
    isActive: boolean;
    /** Sort order for display */
    sortOrder: number;
}
