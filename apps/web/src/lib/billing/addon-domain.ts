/**
 * @file addon-domain.ts
 * @description Scoping the add-on catalog gate on `/mi-cuenta/addons/` per
 * product domain (HOS-689 item 2), reading the domain the API DECLARES
 * (HOS-1178).
 *
 * Before HOS-689 the whole catalog was gated behind ONE check — the caller's
 * ACCOMMODATION subscription (`userApi.getSubscription()` with no
 * `productDomain`, defaulting to accommodation) — so a commerce-only owner,
 * exactly who buys `extra-gastronomies-1`/`extra-experiences-1`, saw the
 * upgrade CTA instead of the product they hold a subscription for. The gate is
 * per-addon: each addon resolves to its product domain and is offered only when
 * the caller holds a usable subscription in THAT domain.
 *
 * ---
 * ## What changed in HOS-1178, and why the derivation had to go
 *
 * This module used to DERIVE the domain from the addon's `affectsLimitKey`
 * (`productDomainForLimitKey`, `@repo/billing`), because that was the only
 * signal on the wire. HOS-1060 then declared `productDomain` on every
 * `AddonDefinition`, and HOS-1178 put it on `AddonResponse` — so there were two
 * live answers to one question, which is the Single Source of Truth rule's own
 * failure mode. The derivation is gone; this reads the declared field.
 *
 * Three things the derivation could not do, each of them a way for the two to
 * disagree:
 *
 * - an addon whose `affectsLimitKey` is `null` (`visibility-boost-7d`/`-30d`)
 *   had nothing to derive from, so it was coerced to accommodation BY HAND — a
 *   guess that happens to be right for those two and would be silently wrong
 *   for the first commerce addon that grants an entitlement without raising a
 *   cap;
 * - two addons raising the SAME cap for different verticals collided;
 * - it lived in the presentation layer, so a direct API call never passed
 *   through it. That half is now closed by `createAddonCheckout`, which refuses
 *   a cross-domain purchase using the same declared field this page reads.
 *   **This module and that route agree by construction**, which they could not
 *   while one derived and the other declared.
 *
 * Purchase mechanics are untouched — this module only decides which addons are
 * SHOWN, never how a purchase is submitted.
 */

import type { ProductDomainValue } from '@repo/schemas';

/**
 * Reads the product domain that gates one addon.
 *
 * The domain arrives on `AddonResponse.productDomain` (HOS-1178) and is `null`
 * when the addon's slug is not in the catalogue — one an operator created
 * through the SPEC-168 admin UI. That is answered `undefined` here and dropped
 * by {@link filterAddonsByHeldDomains}: **never guessed as accommodation**,
 * which is the `?? ACCOMMODATION` HOS-1078 removed from
 * `productDomainForLimitKey` and which would have offered such an addon to
 * every accommodation subscriber. `createAddonCheckout` refuses that same addon
 * with `ADDON_DOMAIN_UNKNOWN`, so the page and the route say the same thing.
 *
 * @param addon - The addon's own `productDomain`, as returned by
 *   `GET /billing/addons` (see `AddonCardData` in
 *   `apps/web/src/lib/api/endpoints-protected.ts`).
 * @returns The product domain that owns this addon's gate, or `undefined` when
 *   the API declared none.
 */
export function resolveAddonProductDomain(addon: {
    readonly productDomain?: string | null;
}): ProductDomainValue | undefined {
    return (addon.productDomain ?? undefined) as ProductDomainValue | undefined;
}

/**
 * Filters an addon catalog down to the addons the caller may currently
 * purchase, given which product domains they hold a usable subscription in.
 *
 * @param params.addons - The full catalog (`GET /billing/addons/available`).
 * @param params.domainsWithSubscription - Product domains the caller holds a
 *   usable subscription in (an entitlement-granting status — see
 *   `isEntitlementGrantingStatus` from `@repo/billing`, called directly by
 *   `mi-cuenta/addons/index.astro` per the HOS-594 static guard, which requires
 *   that call to live in the page's own source).
 * @returns The subset of `addons` whose gating domain is in
 *   `domainsWithSubscription`. An addon whose domain the API did not declare is
 *   dropped — not offered on the assumption it is accommodation.
 */
export function filterAddonsByHeldDomains<T extends { readonly productDomain?: string | null }>({
    addons,
    domainsWithSubscription
}: {
    readonly addons: readonly T[];
    readonly domainsWithSubscription: ReadonlySet<ProductDomainValue>;
}): readonly T[] {
    return addons.filter((addon) => {
        const domain = resolveAddonProductDomain(addon);
        return domain !== undefined && domainsWithSubscription.has(domain);
    });
}
