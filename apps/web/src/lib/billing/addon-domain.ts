/**
 * @file addon-domain.ts
 * @description Pure helpers for scoping the add-on catalog gate on
 * `/mi-cuenta/addons/` per product domain (HOS-689 item 2).
 *
 * Before this, the whole catalog was gated behind ONE check — the caller's
 * ACCOMMODATION subscription (`userApi.getSubscription()` with no
 * `productDomain`, defaulting to accommodation) — so a commerce-only owner,
 * exactly who buys `extra-gastronomies-1`/`extra-experiences-1`, saw the
 * upgrade CTA instead of the product they hold a subscription for. The gate
 * is now per-addon: each addon resolves to the product domain that owns its
 * `affectsLimitKey` (via `productDomainForLimitKey`, `@repo/billing`), and is
 * offered only when the caller holds a usable subscription in THAT domain.
 *
 * Purchase mechanics are untouched — this module only decides which addons
 * are shown, never how a purchase is submitted.
 */

import { isEntitlementGrantingStatus, productDomainForLimitKey } from '@repo/billing';
import { ProductDomainEnum, type ProductDomainValue } from '@repo/schemas';
import type { SubscriptionData } from '@/lib/api/endpoints-protected';

/**
 * Resolves the product domain that gates one addon.
 *
 * `affectsLimitKey: null` (e.g. `visibility-boost-7d`/`-30d`, which target a
 * single accommodation directly rather than raising a numeric limit) is
 * accommodation-scoped by construction — `productDomainForLimitKey` cannot be
 * called with `null`, so that case is handled explicitly rather than coerced
 * into the function's `string` overload.
 *
 * @param addon - The addon's own `affectsLimitKey`, as returned by
 *   `GET /billing/addons` (see `AddonCardData` in
 *   `apps/web/src/lib/api/endpoints-protected.ts`).
 * @returns The product domain that owns this addon's gate.
 */
export function resolveAddonProductDomain(addon: {
    readonly affectsLimitKey: string | null;
}): ProductDomainValue {
    if (addon.affectsLimitKey === null) {
        return ProductDomainEnum.ACCOMMODATION;
    }
    return productDomainForLimitKey(addon.affectsLimitKey);
}

/**
 * Whether a subscription is "usable" for the addon-catalog gate — an
 * entitlement-granting status (active/trialing/comp) OR the web-mapped
 * `'trial'` value.
 *
 * Mirrors the predicate `mi-cuenta/addons/index.astro` already applied
 * page-wide before HOS-689 (see that file's HOS-224/HOS-594 history): the
 * backend is the real purchase gate, this is UX only, so it stays aligned
 * with the same canonical `isEntitlementGrantingStatus` rather than a
 * hand-rolled status list. The one deliberate exception outside the
 * predicate is `'trial'`: the web `SubscriptionStatus` type declares it, but
 * the runtime MP-derived value seen here can be `'trialing'` instead (see
 * `CheckoutStatusPoller`'s `SUCCESS_STATUSES`).
 *
 * @param subscription - The domain-scoped subscription, or `null` when the
 *   caller holds none in that domain.
 */
export function isUsableSubscription(
    subscription: Pick<SubscriptionData, 'status'> | null
): boolean {
    if (!subscription) {
        return false;
    }
    return isEntitlementGrantingStatus(subscription.status) || subscription.status === 'trial';
}

/**
 * Filters an addon catalog down to the addons the caller may currently
 * purchase, given which product domains they hold a usable subscription in.
 *
 * @param params.addons - The full catalog (`GET /billing/addons/available`).
 * @param params.domainsWithSubscription - Product domains the caller holds a
 *   usable subscription in (see {@link isUsableSubscription}).
 * @returns The subset of `addons` whose gating domain is in
 *   `domainsWithSubscription`.
 */
export function filterAddonsByHeldDomains<T extends { readonly affectsLimitKey: string | null }>({
    addons,
    domainsWithSubscription
}: {
    readonly addons: readonly T[];
    readonly domainsWithSubscription: ReadonlySet<ProductDomainValue>;
}): readonly T[] {
    return addons.filter((addon) => domainsWithSubscription.has(resolveAddonProductDomain(addon)));
}
