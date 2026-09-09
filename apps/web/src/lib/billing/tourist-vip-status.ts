/**
 * @file billing/tourist-vip-status.ts
 * @description The client-side read behind the already-VIP disabled state on
 * the tourist cards. HOS-1233 D-4 / AC-16..AC-18.
 *
 * `holdsTouristVipBenefits` (`./tourist-vip-already-held.ts`) is the predicate;
 * this module is the one place that FEEDS it, and the two are separate on
 * purpose — the predicate is pure and unit-testable, this is the I/O.
 *
 * ## One request per domain per page, not per card
 *
 * Same module-singleton pattern as `./trial-clock.ts` and as
 * `PlanPurchaseButton`'s own eligibility cache: the tourist page mounts one
 * island per card plus one per comparison column, all asking the identical
 * customer-scoped question.
 *
 * ## Why three explicit reads and not the default one
 *
 * `GET /protected/users/me/subscription` with no `productDomain` resolves the
 * caller's ACCOMMODATION subscription and, since HOS-1233's API half, falls
 * back to their tourist one. Both halves of that default are wrong here: the
 * fallback would count a tourist's own subscription as a reason to disable
 * their tourist purchase, and one read cannot see the commerce verticals at
 * all. Naming each domain keeps every read strict — an explicit
 * `?productDomain=X` never picks up the fallback.
 *
 * ## The failure direction is R-7's, and it is the opposite of the clock's
 *
 * Every failure resolves to "no subscription in that domain", so an unknown
 * answer leaves the button ENABLED. Telling somebody they already hold a
 * benefit they do not is invisible in testing and costs a sale;
 * `./tourist-vip-already-held.ts` documents the asymmetry in full.
 *
 * @module lib/billing/tourist-vip-status
 */

import { userApi } from '../api/endpoints-protected';
import type {
    SubscriptionStatusReading,
    TouristVipBlockingDomain
} from './tourist-vip-already-held';
import { holdsTouristVipBenefits, TOURIST_VIP_BLOCKING_DOMAINS } from './tourist-vip-already-held';

/** One in-flight (or settled) verdict, shared by every island on the page. */
let vipHeldPromise: Promise<boolean> | null = null;

/**
 * Reads one blocking vertical's subscription status.
 *
 * @param domain - The vertical to ask about.
 * @returns Its status reading, or `null` when there is no subscription there,
 *   the read failed, or the caller is not authenticated.
 */
function readDomainSubscription(
    domain: TouristVipBlockingDomain
): Promise<SubscriptionStatusReading | null> {
    return userApi
        .getSubscription({ productDomain: domain })
        .then((result): SubscriptionStatusReading | null => {
            if (!result.ok || !result.data.subscription) return null;
            // `cancelAtPeriodEnd` is forwarded verbatim, never `?? false`: the
            // wire field is required, so a missing one means the response is
            // not what we think it is — and the predicate resolves an absent
            // flag to "does not hold", which is the safe direction. A `?? false`
            // here would convert that unknown into the claim "they hold it".
            return {
                status: result.data.subscription.status,
                cancelAtPeriodEnd: result.data.subscription.cancelAtPeriodEnd
            };
        })
        .catch(() => null);
}

/**
 * Whether this visitor already holds the tourist-VIP benefits (AC-16).
 *
 * @returns `true` only when a live subscription in accommodation, gastronomy or
 *   experiences carries a benefit-holding status. Anything else — including
 *   every failure mode — is `false`.
 */
export function fetchHoldsTouristVipBenefits(): Promise<boolean> {
    if (vipHeldPromise) return vipHeldPromise;

    vipHeldPromise = Promise.all(
        TOURIST_VIP_BLOCKING_DOMAINS.map((domain) =>
            readDomainSubscription(domain).then((reading) => [domain, reading] as const)
        )
    )
        .then((entries) =>
            holdsTouristVipBenefits({
                subscriptionsByDomain: Object.fromEntries(entries) as Readonly<
                    Partial<Record<TouristVipBlockingDomain, SubscriptionStatusReading | null>>
                >
            })
        )
        .catch(() => false);

    return vipHeldPromise;
}

/**
 * Drops the cached verdict.
 *
 * Exists for tests only — see `resetTrialClockCache` in `./trial-clock.ts` for
 * why a module-singleton cache needs one: without it, the "button is disabled"
 * case and the "button is still enabled" case that keeps it honest cannot live
 * in the same file.
 */
export function resetTouristVipStatusCache(): void {
    vipHeldPromise = null;
}
