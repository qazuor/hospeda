/**
 * Entity-subscription cache reconciliation cron job (HOS-1084, HOS-1292).
 *
 * The backstop for `entity_subscriptions` — all three verticals. The
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
 * ### Two halves, because the two row shapes are not equally derivable
 *
 * **An accommodation row is a full projection.** Which listings it covers comes
 * from `accommodations.owner_id`, so link, status and plan are all re-derivable
 * from live billing — and this job rebuilds every one of them. What it corrects:
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
 * **A commerce row is a link PLUS a projection, and only the projection is
 * derivable** (HOS-1292). Its `entity_id` records which listing the owner chose
 * to spend a subscription slot on — a decision billing does not hold and this
 * job must never invent. Its `status`, though, is nothing but a mirror of
 * `billing_subscriptions.status` for the row's OWN `subscription_id`, written
 * by the same write-through path that can drop it. So the commerce half
 * corrects (1) and only (1): it never creates a link, never prunes one, and
 * never touches `plan_restricted` (the downgrade keep-set decision, equally
 * un-derivable) or `plan_id` (commerce reads its plan off the subscription and
 * leaves the column NULL). A commerce row that is MISSING stays missing, which
 * is never a wrong answer — the public read falls back to the live resolution.
 * Only a row that is present AND wrong can lie, and that is the one this half
 * repairs.
 *
 * An earlier version of this docblock justified skipping commerce entirely with
 * "commerce rows are a link table, not a derivable projection". Half of that
 * was true. The half it got wrong is the half that decides a listing's public
 * visibility, so the write-through path was the only thing standing between a
 * dropped webhook and a permanently mispublished listing.
 *
 * The commerce repair DELEGATES to `reconcileCommerceListingForSubscription`
 * instead of writing the row here: a corrected status has to reach the
 * listing's `visibility` / `lifecycleState` too, and that mapping — with its
 * completeness, moderation and `plan_restricted` terms — must have exactly one
 * definition. It calls the commerce HALF rather than the
 * `reconcileSubscriptionLinkedEntities` bridge because this job has already
 * re-derived every accommodation row in bulk a few lines above; the bridge
 * would redo that work once per drifted subscription.
 *
 * The commerce half is scoped by `entity_type != 'accommodation'`, not by an
 * enumeration of the verticals that exist today. That direction is deliberate:
 * a fourth vertical is covered by this backstop the day its first row is
 * written, rather than the day somebody remembers to add it here — the exact
 * omission HOS-1292 exists to undo.
 *
 * ### Shape
 *
 * A full re-derivation, not a diff-chasing walk: set-shaped reads (owner to
 * accommodation pairs, live accommodation subscriptions, existing cache rows,
 * then the non-accommodation rows and the live status of the subscriptions they
 * point at) and then only the writes that actually change something. Cheap
 * enough to run whole, and — unlike an incremental reconciler — it cannot
 * itself accumulate drift.
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
    ne,
    sql
} from '@repo/db';
import { ProductDomainEnum } from '@repo/schemas';
import { isAccommodationSubscription } from '@repo/service-core';
import { reconcileCommerceListingForSubscription } from '../../services/commerce-reconcile.service.js';
import { ACCOMMODATION_ENTITY_TYPE } from '../../services/entity-subscription-cache.service.js';
import type { CronJobDefinition } from '../types.js';

/** How many rows one upsert / delete statement carries. */
const WRITE_CHUNK_SIZE = 200;

/** Caller label carried into the commerce reconciler's log lines. */
const JOB_SOURCE = 'cron:entity-subscription-cache-reconcile';

/** The subscription state one owner's accommodations should be cached with. */
interface DerivedOwnerState {
    readonly subscriptionId: string | null;
    readonly status: string;
    readonly planId: string | null;
}

/**
 * The negative answer, cached so an unsubscribed host is still a cache HIT.
 *
 * A function rather than a module-level constant, for the same reason as
 * `noSubscription()` in `entity-subscription-cache.service.ts`: `@repo/db` is
 * replaced wholesale by hundreds of test files, and vitest makes any export
 * their factory omits throw ON READ — so reading the sentinel at module scope
 * breaks the IMPORT of every suite that mocks the module, with an error that
 * names this file instead of the incomplete mock.
 */
function noSubscription(): DerivedOwnerState {
    return { subscriptionId: null, status: ENTITY_SUBSCRIPTION_STATUS_NONE, planId: null };
}

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
 *   subscription are absent; the caller substitutes {@link noSubscription}.
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
 * What the commerce half found, and the repair it implies (HOS-1292).
 */
interface CommerceDrift {
    /** Non-accommodation cache rows inspected this run. */
    readonly rowsInspected: number;
    /** Rows whose cached status disagrees with live billing. */
    readonly rowsDrifted: number;
    /**
     * Rows carrying no `subscription_id`. The negative-cache shape belongs to
     * accommodation; commerce never writes one, so this is a diagnostic rather
     * than a repairable state — there is no subscription whose status to mirror.
     */
    readonly rowsUnlinked: number;
    /**
     * Rows whose `subscription_id` resolves to no live `billing_subscriptions`
     * row. Deliberately left alone: "the subscription is gone" has no status to
     * mirror, and picking one here would be inventing the link half this job
     * refuses to invent. Counted so a non-zero value is visible instead of
     * silent.
     */
    readonly rowsWithMissingSubscription: number;
    /** `subscriptionId` → the live status every one of its rows must mirror. */
    readonly repairs: ReadonlyMap<string, string>;
}

/**
 * Compare every non-accommodation cache row against live billing.
 *
 * Two set-shaped reads, mirroring the accommodation half: the rows themselves,
 * then the live status of the subscriptions they point at. The comparison is
 * keyed on the row's own `subscription_id` — never on the owner — so a customer
 * who holds an accommodation plan AND a gastronomy plan at once cannot have one
 * vertical's status resolved from the other's subscription.
 *
 * @returns The drift found, and the per-subscription repair it implies.
 */
async function detectCommerceDrift(): Promise<CommerceDrift> {
    const db = getDb();

    const rows = await db
        .select({
            entityId: entitySubscriptions.entityId,
            entityType: entitySubscriptions.entityType,
            subscriptionId: entitySubscriptions.subscriptionId,
            status: entitySubscriptions.status
        })
        .from(entitySubscriptions)
        .where(ne(entitySubscriptions.entityType, ACCOMMODATION_ENTITY_TYPE));

    const linkedIds = [
        ...new Set(
            rows
                .map((row) => row.subscriptionId)
                .filter((id): id is string => typeof id === 'string' && id.length > 0)
        )
    ];

    const liveStatusById = new Map<string, string>();
    if (linkedIds.length > 0) {
        const liveRows = await db
            .select({ id: billingSubscriptions.id, status: billingSubscriptions.status })
            .from(billingSubscriptions)
            .where(
                and(
                    inArray(billingSubscriptions.id, linkedIds),
                    isNull(billingSubscriptions.deletedAt)
                )
            );
        for (const row of liveRows) {
            liveStatusById.set(row.id, row.status);
        }
    }

    const repairs = new Map<string, string>();
    let rowsDrifted = 0;
    let rowsUnlinked = 0;
    let rowsWithMissingSubscription = 0;

    for (const row of rows) {
        if (typeof row.subscriptionId !== 'string' || row.subscriptionId.length === 0) {
            rowsUnlinked++;
            continue;
        }
        const liveStatus = liveStatusById.get(row.subscriptionId);
        if (liveStatus === undefined) {
            rowsWithMissingSubscription++;
            continue;
        }
        if (row.status === liveStatus) {
            continue;
        }
        rowsDrifted++;
        repairs.set(row.subscriptionId, liveStatus);
    }

    return {
        rowsInspected: rows.length,
        rowsDrifted,
        rowsUnlinked,
        rowsWithMissingSubscription,
        repairs
    };
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
        'Re-derive entity_subscriptions from live billing (HOS-1084 / HOS-1292 backstop): rebuilds every accommodation row (stale status/plan, missing rows, orphans) and corrects the mirrored status of every commerce row, reconciling the listing visibility that follows from it.',
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
                const desired = stateByOwner.get(accommodation.ownerId) ?? noSubscription();
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
                                // HOS-1122: inert for accommodation, which never
                                // sets the flag — written anyway so the invariant
                                // holds for EVERY re-point.
                                planRestricted: false,
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

            // ── 4. The commerce half (HOS-1292) ────────────────────────────
            //
            // Runs AFTER the accommodation writes so the two halves stay as
            // independent here as they are in the write-through reconciler: a
            // commerce read that blows up must not cost the accommodation
            // refresh that already landed.
            const commerceDrift = await detectCommerceDrift();

            let commerceSubscriptionsReconciled = 0;
            if (!dryRun) {
                for (const [subscriptionId, subscriptionStatus] of commerceDrift.repairs) {
                    // Non-throwing by its own contract; it re-points every row
                    // of this subscription and reconciles each linked listing's
                    // visibility through the one definition of "publishable".
                    await reconcileCommerceListingForSubscription({
                        subscriptionId,
                        subscriptionStatus,
                        source: JOB_SOURCE
                    });
                    commerceSubscriptionsReconciled++;
                }
            }

            if (commerceDrift.rowsUnlinked > 0 || commerceDrift.rowsWithMissingSubscription > 0) {
                logger.warn('entity-subscription-cache-reconcile: commerce rows left unrepaired', {
                    rowsUnlinked: commerceDrift.rowsUnlinked,
                    rowsWithMissingSubscription: commerceDrift.rowsWithMissingSubscription
                });
            }

            const durationMs = Date.now() - startedAt.getTime();

            logger.info('entity-subscription-cache-reconcile: done', {
                accommodations: owned.length,
                corrected: toUpsert.length,
                orphansPruned: orphanEntityIds.length,
                commerceRows: commerceDrift.rowsInspected,
                commerceCorrected: commerceDrift.rowsDrifted,
                commerceSubscriptionsReconciled,
                dryRun
            });

            return {
                success: true,
                message: dryRun
                    ? `Dry run — ${toUpsert.length} accommodation row(s) would be written, ${orphanEntityIds.length} orphan(s) pruned, ${commerceDrift.rowsDrifted} commerce row(s) corrected`
                    : `Wrote ${toUpsert.length} accommodation row(s), pruned ${orphanEntityIds.length} orphan(s), corrected ${commerceDrift.rowsDrifted} commerce row(s)`,
                processed: owned.length + commerceDrift.rowsInspected,
                errors: 0,
                durationMs,
                details: {
                    totalAccommodations: owned.length,
                    corrected: toUpsert.length,
                    orphansPruned: orphanEntityIds.length,
                    ownersWithSubscription: stateByOwner.size,
                    commerceRows: commerceDrift.rowsInspected,
                    commerceCorrected: commerceDrift.rowsDrifted,
                    commerceSubscriptionsReconciled,
                    commerceUnlinked: commerceDrift.rowsUnlinked,
                    commerceSubscriptionMissing: commerceDrift.rowsWithMissingSubscription,
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
