/**
 * The vertical ↔ limit-key ↔ product-domain correspondence (HOS-688 §6.8).
 *
 * ---
 * WHY THIS FILE EXISTS
 *
 * Commerce billing is per-owner and per-vertical, so three questions get asked
 * over and over across `apps/api`:
 *
 *   1. which `LimitKey` caps this vertical?          → {@link LIMIT_KEY_BY_COMMERCE_VERTICAL}
 *   2. which subscription domain owns this key?      → {@link productDomainForLimitKey}
 *   3. which plan supplies this key's base value?    → the two above, together
 *
 * Answering any of them at the call site is how the cap silently stops
 * existing: every layer beneath resolves an unknown key to `-1` ("unlimited")
 * and none of them raises. So they are answered exactly once, here.
 *
 * §6.8 G-2 forbids branching *behaviour* by domain — `if (domain ===
 * 'experience') { require approval }`. A `Record<domain, LimitKey>` lookup is
 * explicitly NOT that, and AC-7 says so: it is one code path reading a
 * different value.
 * ---
 *
 * @module config/commerce-limits
 */

import { ProductDomainEnum, type ProductDomainValue } from '@repo/schemas';
import { LimitKey } from '../types/plan.types.js';

/**
 * The two commerce verticals, spelled the way both
 * `commerce_listing_subscriptions.entity_type` and
 * `billing_subscriptions.product_domain` spell them.
 *
 * The collision is deliberate (see `ProductDomainEnum`'s doc): it makes a link
 * row's domain a pure function of its own entity type.
 */
export type CommerceVertical = 'gastronomy' | 'experience';

/**
 * The listing cap of each commerce vertical.
 *
 * Exhaustive over {@link CommerceVertical} by type, so a third vertical is a
 * compile error here rather than an uncapped listing in production.
 */
export const LIMIT_KEY_BY_COMMERCE_VERTICAL: Readonly<Record<CommerceVertical, LimitKey>> = {
    gastronomy: LimitKey.MAX_GASTRONOMIES,
    experience: LimitKey.MAX_EXPERIENCES
} as const;

/**
 * The billing product domain that owns each per-vertical cap.
 *
 * Only the commerce keys appear. Every other `LimitKey` belongs to the
 * accommodation domain, which {@link productDomainForLimitKey} supplies as the
 * default — matching `subscriptionMatchesDomain`'s own rule that an absent
 * `product_domain` reads as accommodation.
 */
const PRODUCT_DOMAIN_BY_LIMIT_KEY: Readonly<Partial<Record<LimitKey, ProductDomainValue>>> = {
    [LimitKey.MAX_GASTRONOMIES]: ProductDomainEnum.GASTRONOMY,
    [LimitKey.MAX_EXPERIENCES]: ProductDomainEnum.EXPERIENCE
};

/**
 * Resolves which subscription domain supplies a limit key's base value.
 *
 * This is what stops the addon recalculator and the entitlement loader from
 * reading a gastronomy cap off the owner's ACCOMMODATION plan — where the key
 * is absent, so the base resolves to zero (or, one layer down, to unlimited).
 *
 * @param limitKey - The limit key being resolved.
 * @returns The owning product domain; `'accommodation'` for every key that is
 *   not a commerce vertical cap.
 *
 * @example
 * ```ts
 * productDomainForLimitKey(LimitKey.MAX_GASTRONOMIES);   // 'gastronomy'
 * productDomainForLimitKey(LimitKey.MAX_ACCOMMODATIONS); // 'accommodation'
 * ```
 */
export function productDomainForLimitKey(limitKey: LimitKey | string): ProductDomainValue {
    return PRODUCT_DOMAIN_BY_LIMIT_KEY[limitKey as LimitKey] ?? ProductDomainEnum.ACCOMMODATION;
}

/**
 * Whether a limit key is one of the per-vertical commerce listing caps.
 *
 * @param limitKey - The limit key to test.
 * @returns `true` for `max_gastronomies` / `max_experiences`.
 */
export function isCommerceVerticalLimitKey(limitKey: LimitKey | string): boolean {
    return PRODUCT_DOMAIN_BY_LIMIT_KEY[limitKey as LimitKey] !== undefined;
}
