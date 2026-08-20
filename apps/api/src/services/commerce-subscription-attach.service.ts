/**
 * Attaching a listing to an owner's EXISTING vertical subscription
 * (HOS-688 §6.8, AC-14).
 *
 * ---
 * THE CASE THAT DOES NOT EXIST UNDER PER-LISTING BILLING
 *
 * Until HOS-688, `commerce_listing_subscriptions` had one row per listing and
 * that row stood in for a subscription of its own: two restaurants meant two
 * MercadoPago preapprovals. Under the per-owner model the same table maps each
 * listing to its VERTICAL's subscription for that owner, and the checkout route
 * forks three ways where it used to fork once:
 *
 * 1. no subscription for this vertical → start one (today's behaviour);
 * 2. a subscription, and the owner is **under** the cap → attach the listing and
 *    open **no checkout at all** — this module;
 * 3. a subscription, and the owner is **at** the cap → refuse, and point at that
 *    vertical's extra-listing add-on.
 *
 * Case 2 is where a per-listing model quietly survives a rename. Leaving the
 * route opening a checkout for the second listing produces a SECOND MercadoPago
 * preapproval, and the owner is charged twice for a plan that already covers
 * them. Nothing about that is visible from the API: both requests answer 201
 * with a valid checkout URL.
 *
 * @module services/commerce-subscription-attach
 */

import { type CommerceVertical, isEntitlementGrantingStatus } from '@repo/billing';
import { commerceListingSubscriptions, eq, getDb } from '@repo/db';
import { ProductDomainEnum, SubscriptionStatusEnum } from '@repo/schemas';
import { subscriptionMatchesDomain } from '@repo/service-core';
import { apiLogger } from '../utils/logger.js';
import { reconcileCommerceListingForSubscription } from './commerce-reconcile.service.js';

/**
 * Statuses under which a link row counts against the owner's cap.
 *
 * Deliberately WIDER than the visibility reconciler's `{active, trialing}`:
 * a `past_due` listing is still occupying a slot the owner is paying (late)
 * for, and `pending_provider` is an in-flight checkout that will occupy one the
 * moment it lands. Counting only the visible ones would let an owner hold N
 * listings by keeping N-1 of them mid-dunning.
 */
const SLOT_OCCUPYING_STATUSES: readonly string[] = [
    SubscriptionStatusEnum.ACTIVE,
    SubscriptionStatusEnum.TRIALING,
    SubscriptionStatusEnum.PAST_DUE,
    SubscriptionStatusEnum.PENDING_PROVIDER
];

/** A live subscription the owner already holds for one vertical. */
export interface OwnerVerticalSubscription {
    readonly id: string;
    readonly status: string;
}

/**
 * Finds the owner's live subscription for ONE commerce vertical.
 *
 * Scoped through the canonical `subscriptionMatchesDomain` predicate rather
 * than a fresh comparison against `productDomain`. That matters here more than
 * usual: a `'commerce'` row (the pre-release-B vocabulary) deliberately does
 * NOT satisfy `'gastronomy'`, because the old value is ambiguous between the
 * two verticals and guessing would charge an experience against a gastronomy
 * cap.
 *
 * @param input.billing - Resolved qzpay billing instance.
 * @param input.customerId - The owner's billing customer id.
 * @param input.vertical - The vertical to scope to.
 * @returns The subscription, or `null` when the owner holds none for it.
 */
export async function findOwnerVerticalSubscription(input: {
    // biome-ignore lint/suspicious/noExplicitAny: QZPayBilling's subscriptions facade is not nameable without importing the whole client type.
    billing: { subscriptions: { getByCustomerId: (id: string) => Promise<any[]> } };
    customerId: string;
    vertical: CommerceVertical;
}): Promise<OwnerVerticalSubscription | null> {
    const { billing, customerId, vertical } = input;
    const domain =
        vertical === 'gastronomy' ? ProductDomainEnum.GASTRONOMY : ProductDomainEnum.EXPERIENCE;

    const subscriptions = await billing.subscriptions.getByCustomerId(customerId);
    const match = (subscriptions ?? []).find(
        (sub: { status: string }) =>
            isEntitlementGrantingStatus(sub.status) && subscriptionMatchesDomain(sub, domain)
    );

    return match ? { id: match.id as string, status: match.status as string } : null;
}

/**
 * Counts how many listings already occupy a slot on one subscription.
 *
 * Counts LINK ROWS rather than listings, because the link row is what a slot
 * actually is: a draft listing the owner has not paid for yet holds no link row
 * and costs them nothing.
 *
 * @param input.subscriptionId - The subscription whose slots are counted.
 * @returns The number of occupied slots.
 */
export async function countAttachedListings(input: { subscriptionId: string }): Promise<number> {
    const db = getDb();
    const rows = await db
        .select({ status: commerceListingSubscriptions.status })
        .from(commerceListingSubscriptions)
        .where(eq(commerceListingSubscriptions.subscriptionId, input.subscriptionId));

    return rows.filter((row) => SLOT_OCCUPYING_STATUSES.includes(row.status)).length;
}

/**
 * Attaches a listing to a subscription the owner already holds, and reconciles
 * its visibility.
 *
 * Two writes, in this order:
 *
 * 1. the link row, upserted on `(entity_type, entity_id)` — the same unique
 *    constraint the per-listing model used, now meaning "which subscription
 *    covers this listing" rather than "this listing's subscription";
 * 2. `reconcileCommerceListingForSubscription`, so an attach onto an already
 *    `active` subscription publishes the listing immediately. Without it the
 *    listing sits PRIVATE until some unrelated webhook happens to fire for that
 *    subscription — the owner pays nothing extra, sees nothing appear, and has
 *    no way to tell whether it worked.
 *
 * @param input.subscription - The owner's existing subscription for the vertical.
 * @param input.entityType - The listing's vertical.
 * @param input.entityId - The listing's id.
 */
export async function attachListingToSubscription(input: {
    subscription: OwnerVerticalSubscription;
    entityType: CommerceVertical;
    entityId: string;
}): Promise<void> {
    const { subscription, entityType, entityId } = input;
    const db = getDb();

    const productDomain =
        entityType === 'gastronomy' ? ProductDomainEnum.GASTRONOMY : ProductDomainEnum.EXPERIENCE;

    await db
        .insert(commerceListingSubscriptions)
        .values({
            subscriptionId: subscription.id,
            productDomain,
            entityType,
            entityId,
            status: subscription.status
        })
        .onConflictDoUpdate({
            target: [
                commerceListingSubscriptions.entityType,
                commerceListingSubscriptions.entityId
            ],
            set: {
                subscriptionId: subscription.id,
                status: subscription.status,
                updatedAt: new Date()
            }
        });

    apiLogger.info(
        { subscriptionId: subscription.id, entityType, entityId, status: subscription.status },
        'commerce listing attached to the owner existing vertical subscription — no checkout opened'
    );

    // Non-throwing by contract (see the reconcile service), so a reconcile
    // failure cannot turn a successful attach into an error the owner retries.
    await reconcileCommerceListingForSubscription({
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        source: 'commerce-attach'
    });
}
