/**
 * Which product domain OWNS a limit key (HOS-1247).
 *
 * ---
 * WHY THIS EXISTS
 *
 * `GET /api/v1/protected/billing/usage/{limitKey}` resolves the subscription
 * whose plan supplies the cap, and it picked that subscription with
 * `productDomain ?? 'accommodation'` — a default that pre-dates the commerce
 * verticals entirely. Measured on staging (HOS-1247, 2026-09-08): an owner
 * holding ONLY a gastronomy subscription got **404 on all four** limit keys,
 * because `findActiveSubscriptionForDomain` found no accommodation row and
 * `getUsageForLimit` answers `null`; and a dual owner — accommodation AND
 * gastronomy — got `max_gastronomies: 0`, because it read that key off the
 * accommodation plan, which of course never declares it.
 *
 * Neither answer is a cap. `max_gastronomies` cannot be answered by an
 * accommodation subscription at all, so which domain to resolve it against is a
 * property of the KEY, not a question for the caller. This module states that
 * property, and the usage route consults it BEFORE falling back to
 * `?productDomain=` — so a caller cannot ask a nonsense question either
 * (`?productDomain=accommodation&limitKey=max_gastronomies` used to answer `0`
 * with a straight face).
 *
 * ## What it deliberately does NOT do
 *
 * Only keys that BELONG to one commerce vertical are mapped. Everything else —
 * `max_accommodations`, and every consumer key a commerce plan also gifts
 * (`max_favorites`, `max_collections`, …) — is absent, so the route keeps its
 * previous behaviour byte-for-byte for them. That is a scope line, not an
 * oversight: a consumer key is declared by the accommodation, tourist AND
 * commerce catalogues at once, so answering "which domain owns it" needs the
 * ordered consumer-domain fallback `loadEntitlements` runs
 * (`selectAccommodationSubscription`), and rerouting that is a change to how
 * ACCOMMODATION resolves its limits.
 *
 * `max_active_private_galleries` is likewise absent although only experiences
 * meter it: gastronomy tiers DECLARE it at `0` (`plans.config.ts`), so it does
 * not discriminate a vertical the way the two maps below do.
 *
 * The two maps are total over `CommerceVertical`, so a third vertical is a
 * compile error in `@repo/billing` before it can reach this inversion.
 *
 * @module utils/limit-key-product-domain
 */

import {
    AI_CHAT_LIMIT_KEY_BY_COMMERCE_VERTICAL,
    type CommerceVertical,
    commerceVerticalToProductDomain,
    LIMIT_KEY_BY_COMMERCE_VERTICAL,
    type LimitKey
} from '@repo/billing';
import type { ProductDomainScope } from '../schemas/product-domain-query.schema';

/**
 * Built by INVERTING the two exhaustive per-vertical maps rather than by
 * restating their pairs: a key added on either side reaches this table without
 * anybody remembering to mirror it, and a pair that ever disagrees is
 * impossible to express.
 */
const PRODUCT_DOMAIN_BY_LIMIT_KEY: ReadonlyMap<LimitKey, ProductDomainScope> = new Map(
    (Object.keys(LIMIT_KEY_BY_COMMERCE_VERTICAL) as CommerceVertical[]).flatMap((vertical) => {
        // `commerceVerticalToProductDomain` is the canonical vertical → domain
        // function (`@repo/billing`); deriving the domain here with a literal
        // would be the "anything not gastronomy is experience" shape HOS-1079
        // removed from five call sites.
        const domain = commerceVerticalToProductDomain(vertical) as ProductDomainScope;
        return [
            [LIMIT_KEY_BY_COMMERCE_VERTICAL[vertical], domain] as const,
            [AI_CHAT_LIMIT_KEY_BY_COMMERCE_VERTICAL[vertical], domain] as const
        ];
    })
);

/**
 * The product domain that owns a limit key, when exactly one does.
 *
 * @param limitKey - The limit key being read. A plain string is accepted
 *   because the usage route's path param is one; an unknown value simply has no
 *   owning domain.
 * @returns The owning domain, or `undefined` when the key is not owned by a
 *   single commerce vertical — in which case the caller keeps whatever
 *   resolution it used before.
 *
 * @example
 * ```ts
 * productDomainForLimitKey('max_gastronomies'); // 'gastronomy'
 * productDomainForLimitKey('max_accommodations'); // undefined
 * ```
 */
export function productDomainForLimitKey(limitKey: string): ProductDomainScope | undefined {
    return PRODUCT_DOMAIN_BY_LIMIT_KEY.get(limitKey as LimitKey);
}
