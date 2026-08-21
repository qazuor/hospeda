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
    /**
     * Primary key of the backing `billing_addons` row (UUID).
     *
     * Present only when the definition was mapped from the database. The static
     * `addons.config.ts` catalog has no row identity, so it is optional — every
     * consumer that keys off `slug` is unaffected.
     *
     * HOS-595: `billing_addon_purchases.addon_id` is a FK to this column and was
     * left NULL on every purchase because the row mapper silently dropped the
     * primary key it already had in hand.
     */
    id?: string;
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
    /**
     * Whether purchasing this add-on requires capturing a target accommodation
     * (SPEC-309 OQ-3). When true, the add-on's effect applies to that single
     * accommodation, not owner-wide. Defaults to false/undefined for add-ons
     * whose effect is not accommodation-scoped.
     */
    requiresAccommodationTarget?: boolean;
}
