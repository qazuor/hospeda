/**
 * Entity-subscription cache reconciliation cron job (HOS-1084).
 *
 * The backstop for the accommodation half of `entity_subscriptions`. The
 * write-through path (`reconcileSubscriptionLinkedEntities`, called from the MP
 * webhook and every billing cron) keeps the cache correct in the normal case;
 * this job is what makes a DESYNC self-healing rather than permanent.
 *
 * That distinction is the whole reason the job exists. A denormalized cache
 * that drifts is worse than no cache: a row that still says `active` keeps
 * premium fields on a listing whose owner stopped paying, and a row stuck at
 * `cancelled` hides features from one who is. Neither surfaces as an error —
 * both look like a working page — so nothing except a periodic re-derivation
 * would ever notice.
 *
 * ### What it corrects
 *
 * 1. **Stale status / plan** — a webhook MercadoPago never delivered, or a
 *    crash between the billing write and the cache write.
 * 2. **Missing rows** — an accommodation created after its owner's last
 *    billing event has no row at all. (Harmless while it lasts: a miss falls
 *    back to the live resolution. This job makes it fast again.)
 * 3. **Orphan rows** — an accommodation hard-deleted out from under its row.
 *    Left alone they would only waste space, but they also make the row count
 *    stop matching the listing count, which is the cheapest signal anyone has
 *    that the cache is healthy.
 *
 * ### Shape
 *
 * A full re-derivation, not a diff-chasing walk: three set-shaped reads (owner
 * to accommodation pairs, live accommodation subscriptions, existing cache
 * rows) and then only the writes that actually change something. Cheap enough
 * to run whole, and — unlike an incremental reconciler — it cannot itself
 * accumulate drift.
 *
 * Only the ACCOMMODATION rows are touched. Commerce rows are a link table, not
 * a derivable projection: their `entity_id` records which listing an owner
 * chose to spend a subscription slot on, which cannot be re-derived from
 * billing. They keep their existing write-through path.
 *
 * @module cron/jobs/entity-subscription-cache-reconcile
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
import { ACCOMMODATION_ENTITY_TYPE } from '../../services/entity-subscription-cache.service.js';
import type { CronJobDefinition } from '../types.js';

/** How many rows one upsert / delete statement carries. */
const WRITE_CHUNK_SIZE = 200;

/** The subscription state one owner's accommodations should be cached with. */
interface DerivedOwnerState {
    readonly subscriptionId: string | null;
    readonly status: string;
    readonly planId: string | null;
}

/** The negative answer, cached so an unsubscribed host is still a cache HIT. */
const NO_SUBSCRIPTION: DerivedOwnerState = {
    subscriptionId: null,
    status: ENTITY_SUBSCRIPTION_STATUS_NONE,
    planId: null
};

/**
 * Derive, for every owner at once, the accommodation subscription their cache
 * rows should mirror.
 *
 * The domain filter runs through {@link isAccommodationSubscription} in
 * TypeScript rather than as a `product_domain` comparison in SQL: that
 * predicate is the only place allowed to compare a subscription's domain, and
 * it fails OPEN for accommodation precisely because the column post-dates most
 * rows. A SQL equality would drop every one of them.
 *
 * @returns ownerId → the state to cache. Owners with no accommodation
 *   subscription are absent; the caller substitutes {@link NO_SUBSCRIPTION}.
 */
async function deriveStateByOwner(): Promise<Map<string, DerivedOwnerState>> {
    const db = getDb();
    const rows = await db
        .select({
            ownerId: billingCustomers.externalId,
            id: billingSubscriptions.id,
            status: billingSubscriptions.status,
            planId: billingSubscriptions.planId,
            productDomain: billingSubscriptions.productDomain,
            createdAt: billingSubscriptions.createdAt
        })
        .from(billingSubscriptions)
        .innerJoin(billingCustomers, eq(billingCustomers.id, billingSubscriptions.customerId))
        .where(and(isNull(billingCustomers.deletedAt), isNull(billingSubscriptions.deletedAt)));

    const byOwner = new Map<string, DerivedOwnerState>();
    const chosenCreatedAt = new Map<string, number>();
    const chosenIsGranting = new Map<string, boolean>();

    for (const row of rows) {
        if (!isAccommodationSubscription(row)) {
            continue;
        }
        const granting = isEntitlementGrantingStatus(row.status);
        const createdAt = row.createdAt?.getTime() ?? 0;
        const incumbentGranting = chosenIsGranting.get(row.ownerId) ?? false;
        const incumbentCreatedAt = chosenCreatedAt.get(row.ownerId) ?? Number.NEGATIVE_INFINITY;

        // An entitlement-granting subscription always wins; between two of the
        // same rank, the newest does.
        const wins =
            !byOwner.has(row.ownerId) ||
            (granting && !incumbentGranting) ||
            (granting === incumbentGranting && createdAt > incumbentCreatedAt);
        if (!wins) {
            continue;
        }

        byOwner.set(row.ownerId, {
            subscriptionId: row.id,
            status: row.status,
            planId: row.planId ?? null
        });
        chosenCreatedAt.set(row.ownerId, createdAt);
        chosenIsGranting.set(row.ownerId, granting);
    }

    return byOwner;
}

/**
 * Entity-subscription cache reconciliation job.
 *
 * Schedule: every 6 hours, aligned with `featured-by-entitlement-reconcile` and
 * with the 6h cron-lag grace period, so a status that enters the grace window
 * is re-derived before that window expires.
 */
export const entitySubscriptionCacheReconcileJob: CronJobDefinition = {
    name: 'entity-subscription-cache-reconcile',
    description:
        'Re-derive the accommodation rows of entity_subscriptions from live billing (HOS-1084 backstop): corrects stale status/plan, fills missing rows and prunes orphans.',
    schedule: '30 */6 * * *',
    enabled: true,
    timeoutMs: 600_000, // 10 minutes

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('entity-subscription-cache-reconcile: starting', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        try {
            const db = getDb();

            // ── 1. Every live accommodation and who owns it ────────────────
            const owned = await db
                .select({ id: accommodations.id, ownerId: accommodations.ownerId })
                .from(accommodations)
                .where(isNull(accommodations.deletedAt));

            // ── 2. What each owner's rows SHOULD say ───────────────────────
            const stateByOwner = await deriveStateByOwner();

            // ── 3. What they currently say ─────────────────────────────────
            const existingRows = await db
                .select({
                    entityId: entitySubscriptions.entityId,
                    subscriptionId: entitySubscriptions.subscriptionId,
                    status: entitySubscriptions.status,
                    planId: entitySubscriptions.planId
                })
                .from(entitySubscriptions)
                .where(eq(entitySubscriptions.entityType, ACCOMMODATION_ENTITY_TYPE));

            const existingByEntityId = new Map(existingRows.map((row) => [row.entityId, row]));
            const liveEntityIds = new Set(owned.map((row) => row.id));

            const toUpsert: Array<{
                subscriptionId: string | null;
                productDomain: string;
                entityType: string;
                entityId: string;
                status: string;
                planId: string | null;
            }> = [];

            for (const accommodation of owned) {
                const desired = stateByOwner.get(accommodation.ownerId) ?? NO_SUBSCRIPTION;
                const current = existingByEntityId.get(accommodation.id);
                const alreadyCorrect =
                    current !== undefined &&
                    (current.subscriptionId ?? null) === desired.subscriptionId &&
                    current.status === desired.status &&
                    (current.planId ?? null) === desired.planId;
                if (alreadyCorrect) {
                    continue;
                }
                toUpsert.push({
                    subscriptionId: desired.subscriptionId,
                    productDomain: ProductDomainEnum.ACCOMMODATION,
                    entityType: ACCOMMODATION_ENTITY_TYPE,
                    entityId: accommodation.id,
                    status: desired.status,
                    planId: desired.planId
                });
            }

            const orphanEntityIds = existingRows
                .map((row) => row.entityId)
                .filter((entityId) => !liveEntityIds.has(entityId));

            if (!dryRun) {
                for (let i = 0; i < toUpsert.length; i += WRITE_CHUNK_SIZE) {
                    await db
                        .insert(entitySubscriptions)
                        .values(toUpsert.slice(i, i + WRITE_CHUNK_SIZE))
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

                for (let i = 0; i < orphanEntityIds.length; i += WRITE_CHUNK_SIZE) {
                    await db
                        .delete(entitySubscriptions)
                        .where(
                            and(
                                eq(entitySubscriptions.entityType, ACCOMMODATION_ENTITY_TYPE),
                                inArray(
                                    entitySubscriptions.entityId,
                                    orphanEntityIds.slice(i, i + WRITE_CHUNK_SIZE)
                                )
                            )
                        );
                }
            }

            const durationMs = Date.now() - startedAt.getTime();

            logger.info('entity-subscription-cache-reconcile: done', {
                accommodations: owned.length,
                corrected: toUpsert.length,
                orphansPruned: orphanEntityIds.length,
                dryRun
            });

            return {
                success: true,
                message: dryRun
                    ? `Dry run — ${toUpsert.length} row(s) would be written, ${orphanEntityIds.length} orphan(s) pruned`
                    : `Wrote ${toUpsert.length} row(s), pruned ${orphanEntityIds.length} orphan(s)`,
                processed: owned.length,
                errors: 0,
                durationMs,
                details: {
                    totalAccommodations: owned.length,
                    corrected: toUpsert.length,
                    orphansPruned: orphanEntityIds.length,
                    ownersWithSubscription: stateByOwner.size,
                    dryRun
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            logger.error(
                'entity-subscription-cache-reconcile: fatal error',
                { error: errorMessage, stack: error instanceof Error ? error.stack : undefined },
                { capture: true }
            );

            return {
                success: false,
                message: `Reconciliation failed: ${errorMessage}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: errorMessage }
            };
        }
    }
};
