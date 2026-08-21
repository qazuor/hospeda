/**
 * The SUBSCRIPTION → ENTITY path for the Path C share-link checkout (HOS-191).
 *
 * ## Why this exists
 *
 * Both domain link tables encode only the ENTITY → SUBSCRIPTION direction and
 * are UPSERTED on a per-entity unique key
 * (`commerce_listing_subscriptions` UNIQUE `(entity_type, entity_id)`,
 * `partner_subscriptions` UNIQUE `partner_id`). Path C creates one
 * `pending_provider` subscription per checkout CLICK rather than per payment,
 * so a second click silently overwrites the only pointer to the first
 * subscription — and the first share link stays perfectly valid on
 * MercadoPago's side. A buyer who double-clicks and then completes the FIRST
 * link activates a subscription no link row points at, which used to end the
 * reconcile in an early return: an unpublished listing with a live charge.
 *
 * The recovery therefore has to start from the subscription, which is why the
 * checkout stamps the entity coordinates into `billing_subscriptions.metadata`
 * (a JSONB column — no schema migration, and the value is immutable
 * checkout-time context rather than mutable state).
 *
 * @module services/billing/subscription-domain-metadata
 */

import { isEntitlementGrantingStatus } from '@repo/billing';
import { billingSubscriptions, eq, getDb } from '@repo/db';

/**
 * Domain coordinates a Path C checkout may stamp on its subscription.
 * Every field is optional: an accommodation checkout stamps none of them.
 */
export interface SubscriptionDomainMetadata {
    /** Commerce entity discriminator (`'gastronomy'` | `'experience'`). */
    readonly commerceEntityType?: string;
    /** UUID of the commerce entity the checkout was started for. */
    readonly commerceEntityId?: string;
    /** UUID of the partner the checkout was started for. */
    readonly partnerId?: string;
}

/**
 * Whether a billing status means the subscription currently entitles its
 * listing to be public, i.e. the only ones allowed to claim a domain link row.
 *
 * Delegates to the canonical `isEntitlementGrantingStatus` (`@repo/billing`),
 * the same predicate `commerce-visibility.ts` uses to decide whether a listing
 * may be PUBLIC. Recovery is scoped to exactly these because the dangerous
 * inverse is a NON-publishing status (`cancelled` on the abandoned first click,
 * reaped by `abandoned-pending-subs`) stealing the row back from the
 * subscription the buyer actually paid, and unpublishing a paid listing.
 *
 * HOS-702: this used to be a hand-rolled `new Set(['active', 'trialing'])`,
 * which excluded `comp` — a complimentary commerce/partner subscription could
 * never claim its own link row, so the listing it paid nothing for (by design)
 * also stayed unpublished.
 *
 * @param status - A `billing_subscriptions.status` value.
 * @returns `true` for the entitlement-granting statuses, `false` otherwise.
 */
export function isPublishingSubscriptionStatus(status: string): boolean {
    return isEntitlementGrantingStatus(status);
}

/**
 * Read the domain coordinates a Path C checkout stamped on a subscription.
 *
 * @param input.subscriptionId - The `billing_subscriptions.id` to read.
 * @returns The coordinates found on `metadata`, or `null` when the row is
 *   missing, has no metadata, or carries none of them (the accommodation path,
 *   and every subscription created before this stamping existed).
 *
 * @example
 * ```ts
 * const coords = await readSubscriptionDomainMetadata({ subscriptionId });
 * if (coords?.partnerId) { // recover the partner link row }
 * ```
 */
export async function readSubscriptionDomainMetadata(input: {
    readonly subscriptionId: string;
}): Promise<SubscriptionDomainMetadata | null> {
    const db = getDb();
    const rows = await db
        .select({ metadata: billingSubscriptions.metadata })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.id, input.subscriptionId))
        .limit(1);

    const metadata = rows[0]?.metadata;
    if (!metadata || typeof metadata !== 'object') {
        return null;
    }

    const record = metadata as Record<string, unknown>;
    const readString = (key: string): string | undefined =>
        typeof record[key] === 'string' && record[key] !== '' ? (record[key] as string) : undefined;

    const coordinates: SubscriptionDomainMetadata = {
        ...(readString('commerceEntityType')
            ? { commerceEntityType: readString('commerceEntityType') as string }
            : {}),
        ...(readString('commerceEntityId')
            ? { commerceEntityId: readString('commerceEntityId') as string }
            : {}),
        ...(readString('partnerId') ? { partnerId: readString('partnerId') as string } : {})
    };

    return Object.keys(coordinates).length > 0 ? coordinates : null;
}
