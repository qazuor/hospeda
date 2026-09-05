import type { ProductDomainValue } from '@repo/schemas';
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
    /**
     * The billing product domain this add-on belongs to (HOS-1060, closing
     * HOS-974 D-C).
     *
     * ## Why `targetCategories` was never enough
     *
     * `PlanCategory` has no commerce member, so every commerce add-on declares
     * `targetCategories: ['owner']` — the same value the accommodation ones
     * carry. `EXTRA_GASTRONOMIES_ADDON`'s own comment has said since HOS-688
     * that *"product_domain is the real discriminator"*, while no add-on
     * declared one. Measured consequence, live in production until this field
     * landed: a gastronomy owner could buy `extra-experiences-1` and vice versa,
     * because the only thing anyone could filter on said `owner` for both.
     *
     * ## Required, and nullable, on purpose
     *
     * The property is REQUIRED (not `productDomain?:`), so a new entry in
     * `addons.config.ts` cannot omit it — writing `'accommodation'` eight times
     * is the point, the same argument `PRODUCT_DOMAIN_BY_LIMIT_KEY` makes for
     * spelling out seventeen. Its VALUE is nullable because
     * `mapRowToAddonDefinition` builds this shape from a `billing_addons` row
     * that may carry a slug the catalogue does not know (an add-on an operator
     * created through the admin UI), and the honest answer there is `undefined`
     * — never `'accommodation'`, which is the specific wrong answer HOS-1078
     * removed one layer down.
     *
     * Callers MUST fail CLOSED on `undefined`: do not offer the add-on, do not
     * apply its effect. Substituting a default at the call site is the `??`
     * again, one level up.
     */
    productDomain: ProductDomainValue | undefined;
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
