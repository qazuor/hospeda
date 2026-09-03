/**
 * Live resolver for "does this experience provider's PLAN currently grant
 * `MANAGE_EXPERIENCE_DIRECTIONS`" (HOS-1049).
 *
 * ## Why this exists, and why it is a live read rather than a synced column
 *
 * The write half of the gate lives on `PATCH /protected/experiences/{id}`, and
 * that alone is not enough. Two states leak past a write-only gate:
 *
 * 1. **Rows written before the gate existed, or before a downgrade.** A
 *    provider who typed their instructions on `experience-pro` and later fell
 *    back to `-basico` keeps the text in the database; only the WRITE is newly
 *    refused. Publishing it regardless would hand `-basico` the paid half for
 *    free, which is the whole thing the gate is for.
 * 2. **The map.** `meeting_point_lat` / `meeting_point_long` are ficha data on
 *    EVERY tier (HOS-1048, owner decision, deliberately not moved to the paid
 *    side by HOS-1049), so their mere presence in the payload says nothing
 *    about entitlement. Something has to tell the public page whether to DRAW
 *    them, and this is it.
 *
 * So the public detail routes ask this resolver, live, on every read: does the
 * CURRENT subscription still carry the key.
 *
 * This mirrors `gastronomy.menu-entitlement.ts`'s
 * `resolveOwnerGrantsGastronomyMenuManagement` deliberately — same layering
 * (direct Drizzle over `billing_customers` / `billing_subscriptions` /
 * `billing_plans`, because `service-core` cannot depend on the QZPay SDK an
 * `apps/api`-only helper wraps), same fail-closed default, and the same reason
 * a synced column is not used: there is nowhere to persist a denormalized flag
 * without a second migration, and a plan change is allowed to take effect at
 * the next (possibly CDN-cached) read rather than instantly.
 *
 * ## Why the two verticals do not share one resolver
 *
 * They very nearly could — the only differences are the product domain and the
 * entitlement key. They are kept apart because `subscriptionMatchesDomain`
 * reads ASYMMETRICALLY by design (SPEC-239): `accommodation` fails OPEN on a
 * missing/`null` column, every other domain fails CLOSED. A shared helper
 * parameterised by domain would invite an accommodation caller, and the first
 * one would silently get the open direction on a gate written for the closed
 * one. Two small closed-domain resolvers cost a duplicated query and remove
 * that footgun entirely.
 *
 * @module services/experience/experience.directions-entitlement
 */

import { ENTITLEMENT_GRANTING_STATUSES, EntitlementKey } from '@repo/billing';
import {
    and,
    billingCustomers,
    billingPlans,
    billingSubscriptions,
    eq,
    getDb,
    inArray,
    isNull
} from '@repo/db';
import { ProductDomainEnum } from '@repo/schemas';
import { subscriptionMatchesDomain } from '../billing/subscription/subscription-product-domain.js';

/**
 * Subscription statuses that keep a plan's entitlements reachable.
 *
 * Aliased to the canonical {@link ENTITLEMENT_GRANTING_STATUSES} rather than
 * re-declared — see `featured-entitlement.resolver.ts` for why a hand-rolled
 * duplicate of this set is how HOS-238/239/594 each shipped a drift bug.
 */
const ACTIVE_PLAN_SUBSCRIPTION_STATUSES = ENTITLEMENT_GRANTING_STATUSES;

/**
 * Input for {@link resolveOwnerGrantsExperienceDirections}.
 */
export interface ResolveOwnerGrantsExperienceDirectionsInput {
    /** `users.id` of the experience listing owner. */
    readonly ownerId: string;
}

/**
 * Resolves whether the provider's CURRENT experience subscription plan grants
 * `MANAGE_EXPERIENCE_DIRECTIONS`.
 *
 * Looks up the owner's billing customer, then their active/trialing/comp
 * EXPERIENCE-domain subscription (SPEC-239 isolation — an owner who is also a
 * host or a restaurateur must not have that subscription's plan consulted
 * here), then checks that plan's `entitlements` array.
 *
 * Fails closed (`false`) when the owner has no billing customer, no qualifying
 * subscription, or the resolved plan is missing / has no entitlements array.
 * An unresolvable plan must never be read as "paid for it" — and here the
 * closed direction is also the only honest one, since the meeting point itself
 * still renders either way and the reader loses an enrichment, not the fact.
 *
 * @param input - The owner id to resolve.
 * @returns `true` when the owner's experience plan includes
 *   `MANAGE_EXPERIENCE_DIRECTIONS`; `false` otherwise.
 */
export async function resolveOwnerGrantsExperienceDirections(
    input: ResolveOwnerGrantsExperienceDirectionsInput
): Promise<boolean> {
    const db = getDb();

    const [customer] = await db
        .select({ id: billingCustomers.id })
        .from(billingCustomers)
        .where(
            and(eq(billingCustomers.externalId, input.ownerId), isNull(billingCustomers.deletedAt))
        )
        .limit(1);

    if (!customer) {
        return false;
    }

    const subscriptionRows = await db
        .select({
            id: billingSubscriptions.id,
            planId: billingSubscriptions.planId,
            status: billingSubscriptions.status,
            productDomain: billingSubscriptions.productDomain
        })
        .from(billingSubscriptions)
        .where(
            and(
                eq(billingSubscriptions.customerId, customer.id),
                isNull(billingSubscriptions.deletedAt),
                inArray(billingSubscriptions.status, ACTIVE_PLAN_SUBSCRIPTION_STATUSES)
            )
        );

    const experienceSubscription = subscriptionRows.find((row) =>
        subscriptionMatchesDomain(row, ProductDomainEnum.EXPERIENCE)
    );

    if (!experienceSubscription) {
        return false;
    }

    const [plan] = await db
        .select({ entitlements: billingPlans.entitlements })
        .from(billingPlans)
        .where(
            and(eq(billingPlans.id, experienceSubscription.planId), isNull(billingPlans.deletedAt))
        )
        .limit(1);

    if (!plan || !Array.isArray(plan.entitlements)) {
        return false;
    }

    return (plan.entitlements as string[]).includes(EntitlementKey.MANAGE_EXPERIENCE_DIRECTIONS);
}
