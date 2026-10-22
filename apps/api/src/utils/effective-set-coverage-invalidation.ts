import { subscribeCoverageInvalidation } from '@repo/verticals';
import { invalidateEffectiveSetsForUser } from './effective-set-cache';
import { getCoverageNotices } from './listing-access/coverage-notices';

let unsubscribe: (() => void) | undefined;

/**
 * Registers the process-wide effective-set invalidation consumer of the
 * coverage-changed notice once; the returned closure tears it down (HOS-1738).
 *
 * Billing emits the notice after commit (activation, cancellation,
 * revocation, suspension, permanent grant, addon removal), but the effective
 * set of the user lives in a Redis cache with a 15-minute TTL. Without this
 * listener a paid plan stays blocked, and a lost plan stays granted, until
 * that TTL expires. It covers every vertical and every change because the gate
 * of every vertical reads the same per-user cache; restricting it to the
 * listing verticals would leave `tourist` and `partner` stale.
 *
 * It uses the single process registry instead of `getListingAccessPorts()`, so
 * it never forces the listing-access composition or the database. The emitter
 * already waits for every listener (`Promise.allSettled`), so a failure here
 * is contained and never breaks the billing writer or the other listeners.
 *
 * @returns The unsubscribe closure for the registered listener
 */
export function subscribeEffectiveSetCoverageInvalidation(): () => void {
    if (unsubscribe) return () => unsubscribe?.();
    unsubscribe = subscribeCoverageInvalidation({
        billing: getCoverageNotices(),
        cache: { invalidateUser: ({ userId }) => invalidateEffectiveSetsForUser(userId) }
    });
    return () => {
        unsubscribe?.();
        unsubscribe = undefined;
    };
}
