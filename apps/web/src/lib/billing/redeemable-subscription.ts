/**
 * @file redeemable-subscription.ts
 * @description Resolves which of the caller's subscriptions a promo code
 * redeemed on `/mi-cuenta/canjear/` should act on (HOS-1293).
 *
 * ## The bug this closes
 *
 * Both redeem-page routes used to call `userApi.getSubscription({ cookieHeader })`
 * with NO `productDomain`, and the endpoint defaults to `'accommodation'`
 * server-side when the param is omitted. A commerce-only owner (a
 * `GASTRONOMY_OWNER`/`EXPERIENCE_OWNER` with no accommodation subscription)
 * therefore always resolved `subscription: null`, so `subscriptionId` reached
 * `RedeemCodeSection` as `undefined` and a DISCOUNT code could never be
 * applied for them — even though the promo-code effect engine has no
 * accommodation-only restriction (see `packages/service-core`'s promo-code
 * module). Trial-extension codes were unaffected (the endpoint resolves those
 * from the session on its own), which is why the bug went unnoticed: only the
 * discount path was silently broken for commerce owners.
 *
 * ## The fix
 *
 * Same multi-domain fan-out `/mi-cuenta/addons/` already uses
 * (`ADDON_GATE_DOMAINS` in that page) — try every real subscribable domain in
 * parallel and take the first one that actually holds a subscription. An
 * account can hold at most one meaningfully "current" subscription for this
 * surface's purpose (one code, applied to one row), so the first match wins;
 * there is no ambiguity to resolve beyond picking a stable order.
 *
 * `'partner'` and `'addon'` are deliberately excluded — `'addon'` is a billing
 * MECHANISM (a recurring add-on's own MercadoPago preapproval), never a
 * customer's real plan subscription (see `ProductDomainEnum`'s doc in
 * `@repo/schemas`), and this surface has never offered a redeem path for
 * partner subscriptions. `ProductDomainScope` already excludes both, which is
 * why {@link REDEEMABLE_SUBSCRIPTION_DOMAINS} can type itself off it directly.
 */

import { userApi } from '@/lib/api/endpoints-protected';
import type { ProductDomainScope } from '@/lib/api/types';
import { webLogger as logger } from '@/lib/logger';

/**
 * The domains tried, in order, when resolving the redeemable subscription.
 *
 * Accommodation first — preserves the exact pre-fix behaviour for every host,
 * who is still the large majority of subscribers. Gastronomy before
 * experience is an arbitrary but deterministic tie-break for the rare account
 * that somehow holds an active subscription in both commerce verticals and
 * none in accommodation; only one of them can be "the" subscription this page
 * names. Tourist last: a paying `tourist-vip` redeeming a code is a real case
 * (HOS-1233 gave tourist plans their own domain) but a much smaller audience
 * than the three vertical owners.
 */
const REDEEMABLE_SUBSCRIPTION_DOMAINS: readonly ProductDomainScope[] = [
    'accommodation',
    'gastronomy',
    'experience',
    'tourist'
];

/**
 * Resolves the id of the subscription a redeemed DISCOUNT code should act on,
 * trying every real subscribable domain and returning the first one with an
 * active subscription.
 *
 * Degrades to `undefined` on ANY failure — every fetch failing, or the
 * account holding no subscription in any domain. `RedeemCodeSection`'s own
 * docblock explains why that is safe: the surface's primary job is
 * trial-extension codes, which the endpoint resolves from the session on its
 * own, so a failure here only means a discount code will be refused with
 * "keep it for checkout" instead of being applied.
 *
 * @param params.cookieHeader - Raw `Cookie` header of the SSR request.
 * @returns The first held subscription's id across
 *   {@link REDEEMABLE_SUBSCRIPTION_DOMAINS}, or `undefined`.
 *
 * @example
 * ```ts
 * const subscriptionId = await resolveRedeemableSubscriptionId({
 *     cookieHeader: Astro.request.headers.get('cookie') ?? undefined
 * });
 * ```
 */
export async function resolveRedeemableSubscriptionId({
    cookieHeader
}: {
    readonly cookieHeader: string | undefined;
}): Promise<string | undefined> {
    try {
        const results = await Promise.all(
            REDEEMABLE_SUBSCRIPTION_DOMAINS.map((productDomain) =>
                userApi.getSubscription({ cookieHeader, productDomain })
            )
        );

        for (const result of results) {
            if (result.ok && result.data.subscription) {
                return result.data.subscription.id;
            }
        }

        return undefined;
    } catch (error) {
        logger.warn('resolveRedeemableSubscriptionId: failed to resolve subscription', { error });
        return undefined;
    }
}
