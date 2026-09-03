/**
 * Accommodation half of the shared subscription-status cache (HOS-1084).
 *
 * `entity_subscriptions` (formerly `commerce_listing_subscriptions`) has always
 * done two jobs for commerce: map a subscription to the listings it covers, and
 * let a public request read the status without joining `billing_subscriptions`.
 * Accommodation needs only the second — it maps its listings from
 * `accommodations.owner_id` — and had no cache at all: every cold public render
 * resolved the owner's entitlements live against QZPay (customer lookup →
 * subscriptions → plan), patched over with hand-rolled per-process `Map`s that
 * died on each deploy and were never shared between API instances.
 *
 * This module owns the accommodation rows of that table: how they are written
 * (from every billing-lifecycle site, through the single reconciler) and how
 * they are read (one batched query per public listing page).
 *
 * ---
 * THE ROW SHAPE, AND WHY THERE IS A NEGATIVE ROW
 *
 * One row per accommodation — `entity_type = 'accommodation'`,
 * `entity_id = accommodations.id` — so the table's `UNIQUE(entity_type,
 * entity_id)` keeps meaning "one row per LISTING". A host with three properties
 * has three rows pointing at the same subscription. That is the whole point of
 * the constraint being on the pair and not on `subscription_id`, which would
 * reject the second property of every multi-property host.
 *
 * A host with NO subscription still gets rows, carrying
 * {@link ENTITY_SUBSCRIPTION_STATUS_NONE} and a `NULL` subscription. Without
 * them the most common case on the platform — an unsubscribed host — would miss
 * the cache on every single request and fall through to the live billing walk
 * this table exists to remove, which is a REGRESSION against the in-memory maps
 * it replaces, not an improvement.
 *
 * ---
 * A DESYNCED CACHE IS WORSE THAN NO CACHE
 *
 * A stale row hides a listing whose owner is paying, or keeps showing paid
 * features to one who stopped. Three defenses, in the order they fire:
 *
 * 1. **Write-through at every lifecycle site.** Every place that moves a
 *    subscription's status already calls one reconciler
 *    (`reconcileSubscriptionLinkedEntities`) — the MP webhook, dunning,
 *    `finalize-cancelled-subs`, `abandoned-pending-subs`,
 *    `preapproval-less-expiry`, and the commerce attach path. This module hangs
 *    off that same call, so there is no site to remember to wire up.
 * 2. **The `entity-subscription-cache-reconcile` cron.** It rebuilds every
 *    accommodation row from live billing on a schedule, so a dropped webhook or
 *    a crash between the billing write and this one self-heals.
 * 3. **A miss is never wrong.** The public read falls back to the live
 *    resolution it used before this table existed. Only a row that is present
 *    AND wrong can lie — which is what (1) and (2) defend.
 *
 * A further guard is structural: the sync never blindly stamps the triggering
 * subscription's status onto the owner's rows. It RE-DERIVES the owner's
 * current accommodation subscription from the database and writes that. So a
 * webhook for a subscription the owner already replaced cannot un-publish the
 * one they are actually paying for.
 *
 * @module services/entity-subscription-cache.service
 */

import { isEntitlementGrantingStatus } from '@repo/billing';
import {
    accommodations,
    and,
    billingCustomers,
    billingSubscriptions,
    ENTITY_SUBSCRIPTION_STATUS_NONE,
    entitySubscriptions,
    eq,
    getDb,
    inArray,
    isNull,
    sql
} from '@repo/db';
import { ProductDomainEnum } from '@repo/schemas';
import { isAccommodationSubscription } from '@repo/service-core';
import { apiLogger } from '../utils/logger.js';

/**
 * `entity_type` discriminator for an accommodation row.
 *
 * A plain constant rather than a member of `CommerceEntityTypeEnum`: that enum
 * is the closed set of COMMERCE verticals and accommodation is not one of them.
 */
export const ACCOMMODATION_ENTITY_TYPE = 'accommodation';

/**
 * The cached answer for one owner: the status of their accommodation
 * subscription and the plan it runs on.
 */
export interface CachedOwnerSubscription {
    /**
     * Mirror of `billing_subscriptions.status`, or
     * {@link ENTITY_SUBSCRIPTION_STATUS_NONE} when the owner holds no
     * accommodation subscription at all.
     */
    readonly status: string;
    /** `billing_subscriptions.plan_id`, or `null` on a negative row. */
    readonly planId: string | null;
}

/** The owner's current accommodation subscription, as re-derived from the DB. */
interface OwnerAccommodationSubscription {
    readonly id: string | null;
    readonly status: string;
    readonly planId: string | null;
}

/** The negative answer — cached, so it costs one indexed read instead of a walk. */
const NO_SUBSCRIPTION: OwnerAccommodationSubscription = {
    id: null,
    status: ENTITY_SUBSCRIPTION_STATUS_NONE,
    planId: null
};

/**
 * How many rows one upsert statement carries. Owners hold single-digit
 * portfolios in practice; the chunk only bounds the pathological case.
 */
const UPSERT_CHUNK_SIZE = 200;

/**
 * Re-derive an owner's current accommodation subscription straight from the
 * database.
 *
 * The domain filter runs in TYPESCRIPT, through {@link isAccommodationSubscription},
 * never as a SQL comparison on `product_domain`. That predicate is the only
 * place in the codebase allowed to compare a subscription's domain, and it
 * reads asymmetrically on purpose: `accommodation` fails OPEN (a `null` column
 * counts as accommodation, because the column post-dates most rows) while every
 * other domain fails closed. Re-deriving that rule in SQL would silently drop
 * every pre-column row.
 *
 * @param ownerId - `users.id` of the accommodation owner.
 * @returns The entitlement-granting subscription when there is one, else the
 *   most recent accommodation subscription, else {@link NO_SUBSCRIPTION}.
 */
async function deriveOwnerAccommodationSubscription(
    ownerId: string
): Promise<OwnerAccommodationSubscription> {
    const db = getDb();
    const rows = await db
        .select({
            id: billingSubscriptions.id,
            status: billingSubscriptions.status,
            planId: billingSubscriptions.planId,
            productDomain: billingSubscriptions.productDomain,
            createdAt: billingSubscriptions.createdAt
        })
        .from(billingSubscriptions)
        .innerJoin(billingCustomers, eq(billingCustomers.id, billingSubscriptions.customerId))
        .where(
            and(
                eq(billingCustomers.externalId, ownerId),
                isNull(billingCustomers.deletedAt),
                isNull(billingSubscriptions.deletedAt)
            )
        );

    const accommodationSubs = rows.filter((row) => isAccommodationSubscription(row));
    if (accommodationSubs.length === 0) {
        return NO_SUBSCRIPTION;
    }

    const granting = accommodationSubs.find((row) => isEntitlementGrantingStatus(row.status));
    // Newest first, so a non-granting fallback describes the owner's latest
    // state rather than an arbitrary historical one.
    const chosen =
        granting ??
        [...accommodationSubs].sort(
            (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
        )[0];

    if (!chosen) {
        return NO_SUBSCRIPTION;
    }
    return { id: chosen.id, status: chosen.status, planId: chosen.planId ?? null };
}

/**
 * Write the owner's derived subscription onto every one of their
 * accommodations' cache rows.
 *
 * @param input.ownerId - `users.id` of the accommodation owner.
 * @param input.source - Caller label for log diagnostics.
 * @returns How many rows were written (0 when the owner has no accommodations).
 */
export async function syncAccommodationSubscriptionCacheForOwner(input: {
    ownerId: string;
    source: string;
}): Promise<number> {
    const { ownerId, source } = input;
    const db = getDb();

    const owned = await db
        .select({ id: accommodations.id })
        .from(accommodations)
        .where(and(eq(accommodations.ownerId, ownerId), isNull(accommodations.deletedAt)));

    if (owned.length === 0) {
        return 0;
    }

    const derived = await deriveOwnerAccommodationSubscription(ownerId);

    const values = owned.map((row) => ({
        subscriptionId: derived.id,
        productDomain: ProductDomainEnum.ACCOMMODATION as string,
        entityType: ACCOMMODATION_ENTITY_TYPE,
        entityId: row.id,
        status: derived.status,
        planId: derived.planId
    }));

    for (let offset = 0; offset < values.length; offset += UPSERT_CHUNK_SIZE) {
        await db
            .insert(entitySubscriptions)
            .values(values.slice(offset, offset + UPSERT_CHUNK_SIZE))
            .onConflictDoUpdate({
                target: [entitySubscriptions.entityType, entitySubscriptions.entityId],
                set: {
                    subscriptionId: sql`excluded.subscription_id`,
                    productDomain: sql`excluded.product_domain`,
                    status: sql`excluded.status`,
                    planId: sql`excluded.plan_id`,
                    updatedAt: new Date()
                }
            });
    }

    apiLogger.info(
        {
            ownerId,
            subscriptionId: derived.id,
            status: derived.status,
            planId: derived.planId,
            rows: values.length,
            source
        },
        'Accommodation subscription-status cache synced for owner'
    );

    return values.length;
}

/**
 * Resolve the owner behind a billing subscription.
 *
 * `billing_customers.external_id` is the `users.id` the signup hook stamped, so
 * this is the whole mapping: subscription → customer → owner.
 *
 * @param subscriptionId - `billing_subscriptions.id`.
 * @returns The owner's `users.id`, or `null` when the subscription or its
 *   customer cannot be resolved.
 */
async function resolveSubscriptionOwnerId(subscriptionId: string): Promise<string | null> {
    const db = getDb();
    const [row] = await db
        .select({ ownerId: billingCustomers.externalId })
        .from(billingSubscriptions)
        .innerJoin(billingCustomers, eq(billingCustomers.id, billingSubscriptions.customerId))
        .where(eq(billingSubscriptions.id, subscriptionId))
        .limit(1);

    return row?.ownerId ?? null;
}

/**
 * Write-through hook for the billing lifecycle: refresh the accommodation cache
 * rows of whoever owns this subscription.
 *
 * Non-throwing by contract — it runs from the MP webhook and the billing crons,
 * none of which may break because a cache refresh failed. A failure leaves a
 * stale row that the reconcile cron corrects.
 *
 * Deliberately takes only the subscription id: the status is re-derived, not
 * accepted from the caller, so a late webhook for a superseded subscription
 * cannot overwrite the state of the one the owner actually holds.
 *
 * @param input.subscriptionId - The subscription whose status moved.
 * @param input.source - Caller label for log diagnostics.
 */
export async function syncAccommodationSubscriptionCacheForSubscription(input: {
    subscriptionId: string;
    source: string;
}): Promise<void> {
    const { subscriptionId, source } = input;
    try {
        const ownerId = await resolveSubscriptionOwnerId(subscriptionId);
        if (!ownerId) {
            return;
        }
        await syncAccommodationSubscriptionCacheForOwner({ ownerId, source });
    } catch (error) {
        apiLogger.error(
            {
                subscriptionId,
                source,
                error: error instanceof Error ? error.message : String(error)
            },
            'Accommodation subscription-status cache sync failed — skipping (non-blocking); the reconcile cron will correct it'
        );
    }
}

/**
 * Batched public read: the cached subscription status + plan for a page's worth
 * of accommodation owners, in ONE indexed query.
 *
 * Joins through `accommodations` because the rows are keyed per LISTING while
 * the entitlement question is asked per OWNER. Every row of one owner carries
 * the same answer, so a disagreement can only come from a partially-applied
 * sync; an entitlement-granting row wins, which fails in the direction of the
 * host who is paying.
 *
 * Owners absent from the returned map are cache MISSES and must be resolved
 * live by the caller — never treated as "no subscription".
 *
 * @param ownerIds - Owner `users.id` values. Duplicates tolerated.
 * @returns A map of ownerId → cached answer, containing only cache hits.
 */
export async function readAccommodationSubscriptionCacheByOwnerIds(
    ownerIds: readonly string[]
): Promise<Map<string, CachedOwnerSubscription>> {
    const resolved = new Map<string, CachedOwnerSubscription>();
    const unique = [...new Set(ownerIds)];
    if (unique.length === 0) {
        return resolved;
    }

    const db = getDb();
    const rows = await db
        .select({
            ownerId: accommodations.ownerId,
            status: entitySubscriptions.status,
            planId: entitySubscriptions.planId
        })
        .from(entitySubscriptions)
        .innerJoin(accommodations, eq(accommodations.id, entitySubscriptions.entityId))
        .where(
            and(
                eq(entitySubscriptions.entityType, ACCOMMODATION_ENTITY_TYPE),
                inArray(accommodations.ownerId, unique)
            )
        );

    for (const row of rows) {
        const existing = resolved.get(row.ownerId);
        if (existing && isEntitlementGrantingStatus(existing.status)) {
            continue;
        }
        resolved.set(row.ownerId, { status: row.status, planId: row.planId ?? null });
    }

    return resolved;
}
