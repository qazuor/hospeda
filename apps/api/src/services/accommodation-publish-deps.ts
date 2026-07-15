/**
 * @file accommodation-publish-deps.ts
 * @description Factory that adapts the API-level billing data into the
 * `AccommodationPublishDeps` interface `AccommodationService.publish()` consumes
 * from `@repo/service-core`.
 *
 * Why the factory lives in `apps/api`: `service-core` cannot import from
 * `apps/api` (one-way dependency rule).
 *
 * ## It used to do much more (HOS-171)
 *
 * This file used to also own `startTrial` / `cancelTrial`: publishing an
 * accommodation silently created a no-card trial subscription for a first-time
 * owner, mid-flow. That meant an external MercadoPago call had to run outside
 * the local transaction, with an 8s timeout, plus a compensating cancel if the
 * local write then failed, plus a "manual reconciliation required" log for when
 * the compensation ALSO failed.
 *
 * Card-first removed all of it. Publishing creates nothing at MercadoPago — an
 * owner without a live subscription is sent to the plans page, authorizes a card
 * there, and their trial begins as an ordinary preapproval. So there is no
 * external call here any more, no compensation, and no reconciliation hazard:
 * what is left is one read of the billing tables.
 */
import { isSubscriptionLive } from '@repo/billing';
import { billingCustomers, billingSubscriptions, desc, eq, getDb } from '@repo/db';
import type { AccommodationPublishDeps, PublishEligibility } from '@repo/service-core';

/**
 * Builds the publish dependencies that `AccommodationService.publish()` needs.
 * Pass the result to the `AccommodationService` constructor as the fifth
 * argument.
 *
 * Takes no billing client: eligibility is answered entirely from the local
 * billing tables. The factory shape is kept (rather than exporting the callback
 * directly) so that adding a dependency later does not ripple through every
 * `AccommodationService` construction site.
 *
 * An owner with no billing customer, or with no subscriptions at all, answers
 * `first_publish` — which `publish()` now rejects to the plans page exactly like
 * `subscription_required`. The two stay distinct because the front-end has
 * grounds to word them differently.
 */
export function buildAccommodationPublishDeps(): AccommodationPublishDeps {
    return {
        checkEligibility: async (ownerId: string): Promise<PublishEligibility> => {
            const db = getDb();
            const [customer] = await db
                .select()
                .from(billingCustomers)
                .where(eq(billingCustomers.externalId, ownerId))
                .limit(1);
            if (!customer) {
                return 'first_publish';
            }
            const subscriptions = await db
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.customerId, customer.id))
                .orderBy(desc(billingSubscriptions.createdAt))
                .limit(10);
            if (subscriptions.length === 0) {
                return 'first_publish';
            }
            const hasActive = subscriptions.some((s) =>
                isSubscriptionLive({
                    status: s.status,
                    trialEnd: s.trialEnd,
                    currentPeriodEnd: s.currentPeriodEnd
                })
            );
            return hasActive ? 'has_active_sub' : 'subscription_required';
        }
    };
}
