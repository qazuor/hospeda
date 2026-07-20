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
import {
    type AccommodationPublishDeps,
    isAccommodationSubscription,
    isOwnerCategorySubscription,
    type PublishEligibility
} from '@repo/service-core';

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
 *
 * **HOS-217**: a live subscription alone is not enough to publish — it must
 * also be an `owner`/`complex`-category plan. Without this, a HOST who
 * reached that role via host-onboarding (without ever subscribing to an
 * owner plan) but still has a live *tourist* subscription (e.g.
 * `tourist-vip`) would answer `has_active_sub` and be allowed to publish
 * with no host plan at all. Such an owner now answers `subscription_required`
 * — the SAME outcome (and the same already-localized "no active plan, go
 * pick one" UI) as an owner with zero subscriptions, so no new front-end
 * copy is needed.
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
            const liveSubscriptions = subscriptions.filter((s) =>
                isSubscriptionLive({
                    status: s.status,
                    trialEnd: s.trialEnd,
                    currentPeriodEnd: s.currentPeriodEnd
                })
            );
            if (liveSubscriptions.length === 0) {
                return 'subscription_required';
            }
            // SPEC-239 T-034 / commerce-listing quirk: `commerce-listing` and
            // `partner-listing` plans have `metadata.category = 'owner'` on
            // purpose (see isOwnerCategorySubscription's docstring), so they
            // would otherwise pass the owner/complex check below despite
            // being a different product entirely. Filter to the accommodation
            // product domain FIRST — before ever asking whether a plan is
            // owner/complex-category — so a host whose only live subscription
            // is a commerce-domain plan answers subscription_required, not
            // has_active_sub.
            const accommodationLiveSubscriptions = liveSubscriptions.filter((sub) =>
                isAccommodationSubscription(sub)
            );
            // Sequential (not Promise.all) by design: short-circuits on the
            // first owner/complex match instead of resolving every live
            // subscription's plan category up front — a customer has at most
            // 1-2 live subscriptions in practice (one per product domain).
            for (const sub of accommodationLiveSubscriptions) {
                if (await isOwnerCategorySubscription({ planId: sub.planId, tx: db })) {
                    return 'has_active_sub';
                }
            }
            return 'subscription_required';
        }
    };
}
