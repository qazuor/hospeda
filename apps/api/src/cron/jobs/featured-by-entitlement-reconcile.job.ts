/**
 * Featured-By-Entitlement Reconciliation Cron Job (SPEC-309 T-014, renamed +
 * extended from SPEC-292 T-006).
 *
 * Backstop that corrects drift between each vertical's
 * `featuredByEntitlement` column and the billing sources of truth behind it.
 *
 * Accommodation (SPEC-309 OQ-3) has TWO independent sources; gastronomy and
 * experience (HOS-1286) have only the addon, because no commerce plan grants
 * FEATURED_LISTING. The two sources for accommodation are:
 *
 * - **Plan** — an owner's accommodation subscription plan grants
 *   FEATURED_LISTING owner-wide (all of the owner's accommodations).
 * - **Addon** — a `visibility-boost-7d`/`-30d` purchase grants featuring
 *   scoped to the single accommodation it was purchased for.
 *
 * Runs every 6 hours to capture transitions (dunning retry_succeeded, manual
 * admin comp, reactivations, plan upgrades/downgrades, addon purchase/expiry)
 * that the T-008..T-013/T-015/T-016 event hooks may have missed.
 *
 * ### Algorithm (per owner, sequential — no thundering herd against the DB)
 *
 * 1. Query distinct ownerIds from non-deleted accommodations (one DB round-trip).
 * 2. For each owner:
 *    a. Resolve `shouldBeFeaturedByPlan` via `resolveOwnerPlanGrantsFeatured`
 *       (T-004) — a direct DB query, unlike the T-006 predecessor's QZPay SDK
 *       calls.
 *    b. Read all non-deleted accommodation rows for the owner (id +
 *       featuredByEntitlement) and the set of accommodation ids holding a
 *       LIVE featured-listing addon grant
 *       (`getOwnerAccommodationIdsWithActiveFeaturedAddon`, T-004).
 *    c. **Plan-drift guard**: among rows NOT addon-protected, if any row's
 *       `featuredByEntitlement` disagrees with `shouldBeFeaturedByPlan`, call
 *       `syncFeaturedByEntitlementForOwner` (T-005) once for the owner — it
 *       already excludes addon-protected rows on a revoke, so a single bulk
 *       call is safe. This also naturally clears any accommodation whose
 *       addon expired without T-016's hook firing (once expired, the row is
 *       no longer addon-protected, so it re-enters the plan-driven
 *       comparison).
 *    d. **Addon-drift guard** (only when `shouldBeFeaturedByPlan` is false —
 *       when true, every accommodation is already owner-wide featured, so
 *       there is nothing for an addon grant to add): for each addon-protected
 *       accommodation, if its `featuredByEntitlement` is currently `false`
 *       (the T-007 checkout-confirm hook missed the grant), call
 *       `syncFeaturedByEntitlementForAccommodation` (T-005) to set it `true`.
 * 3. **The two commerce verticals** (HOS-1286) — a two-way set difference
 *    between the live grants and the rows flagged `featuredByEntitlement`, per
 *    vertical. NOT the owner walk above: accommodation needs it because a PLAN
 *    can grant featuring owner-wide, while no commerce plan grants
 *    FEATURED_LISTING, so for gastronomy and experience the live grants ARE the
 *    complete expected set. Both directions are corrected — a missing flag is a
 *    purchase hook that did not fire, an extra one is a boost that expired and
 *    is still being given away.
 * 4. Log corrected-count separately per source (plan vs addon vs commerce) for
 *    observability.
 *
 * @module cron/jobs/featured-by-entitlement-reconcile
 */

import { accommodations, and, eq, experiences, gastronomies, getDb, isNull } from '@repo/db';
import { ProductDomainEnum } from '@repo/schemas';
import {
    type CommerceFeaturedEntityType,
    getActiveFeaturedGrantEntityIds,
    getOwnerAccommodationIdsWithActiveFeaturedAddon,
    resolveOwnerPlanGrantsFeatured,
    syncFeaturedByEntitlementForAccommodation,
    syncFeaturedByEntitlementForCommerceListing,
    syncFeaturedByEntitlementForOwner
} from '@repo/service-core';

/** The two commerce verticals step 3 sweeps (HOS-1286). */
const COMMERCE_FEATURED_VERTICALS: readonly CommerceFeaturedEntityType[] = [
    ProductDomainEnum.GASTRONOMY,
    ProductDomainEnum.EXPERIENCE
];

/**
 * Listing table per commerce vertical, for the drift read.
 *
 * A function rather than a module-level record, for the same reason
 * `commerce.sync-featured-by-entitlement.ts` uses one: reading a `@repo/db`
 * export at import time breaks every suite that partially mocks that module.
 */
const commerceTable = (entityType: CommerceFeaturedEntityType) =>
    entityType === ProductDomainEnum.GASTRONOMY ? gastronomies : experiences;

import type { CronJobDefinition } from '../types.js';

// ---------------------------------------------------------------------------
// Job definition
// ---------------------------------------------------------------------------

/**
 * Featured-by-entitlement reconciliation cron job.
 *
 * Schedule: Every 6 hours (`0 *​/6 * * *`) — aligned with the cron-lag grace
 * period (BILLING_CRON_LAG_GRACE_HOURS = 6h per CLAUDE.md) so any billing
 * state that enters the grace window is caught before that window expires.
 *
 * Timeout: 10 minutes — generous for large installations. Unlike the T-006
 * predecessor, every lookup here is a direct DB query (no QZPay SDK calls),
 * so this runs materially faster per owner.
 */
export const featuredByEntitlementReconcileJob: CronJobDefinition = {
    name: 'featured-by-entitlement-reconcile',
    description:
        'Correct drift between accommodations.featuredByEntitlement and its plan/addon billing sources of truth (SPEC-309 T-014 backstop).',
    schedule: '0 */6 * * *',
    enabled: true,
    timeoutMs: 600_000, // 10 minutes

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('featured-by-entitlement-reconcile: starting', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        let correctedPlanOwners = 0;
        let correctedAddonAccommodations = 0;
        let correctedCommerceListings = 0;
        let totalRowsUpdated = 0;
        let errors = 0;

        try {
            const db = getDb();

            // Step 1: distinct ownerIds from non-deleted accommodations.
            const ownerRows = await db
                .selectDistinct({ ownerId: accommodations.ownerId })
                .from(accommodations)
                .where(isNull(accommodations.deletedAt));

            const ownerIds = ownerRows.map((r) => r.ownerId);

            logger.info('featured-by-entitlement-reconcile: owners to check', {
                count: ownerIds.length
            });

            // Step 2: process each owner sequentially.
            for (const ownerId of ownerIds) {
                try {
                    // 2a: Resolve the plan-driven expectation (T-004).
                    const shouldBeFeaturedByPlan = await resolveOwnerPlanGrantsFeatured({
                        ownerId
                    });

                    // 2b: Read all non-deleted accommodation rows + addon-protected set.
                    const ownerAccommodationRows = await db
                        .select({
                            id: accommodations.id,
                            featuredByEntitlement: accommodations.featuredByEntitlement
                        })
                        .from(accommodations)
                        .where(
                            and(
                                eq(accommodations.ownerId, ownerId),
                                isNull(accommodations.deletedAt)
                            )
                        );

                    if (ownerAccommodationRows.length === 0) {
                        // Owner has no non-deleted accommodations — nothing to sync.
                        continue;
                    }

                    const addonProtectedIds = new Set(
                        await getOwnerAccommodationIdsWithActiveFeaturedAddon({ ownerId })
                    );

                    // 2c: Plan-drift guard — among non-addon-protected rows, any
                    // mismatch triggers a single owner-wide bulk correction (which
                    // already excludes addon-protected rows on revoke).
                    const planDrivenRows = ownerAccommodationRows.filter(
                        (row) => !addonProtectedIds.has(row.id)
                    );
                    const planDrift = planDrivenRows.some(
                        (row) => (row.featuredByEntitlement ?? false) !== shouldBeFeaturedByPlan
                    );

                    if (planDrift) {
                        logger.info(
                            'featured-by-entitlement-reconcile: plan drift detected, correcting',
                            { ownerId, expected: shouldBeFeaturedByPlan, dryRun }
                        );

                        if (dryRun) {
                            correctedPlanOwners++;
                        } else {
                            const { updated } = await syncFeaturedByEntitlementForOwner({
                                ownerId,
                                active: shouldBeFeaturedByPlan
                            });
                            correctedPlanOwners++;
                            totalRowsUpdated += updated;
                        }
                    }

                    // 2d: Addon-drift guard — only meaningful when the plan does NOT
                    // already cover the owner's whole portfolio.
                    if (!shouldBeFeaturedByPlan) {
                        for (const accommodationId of addonProtectedIds) {
                            const row = ownerAccommodationRows.find(
                                (r) => r.id === accommodationId
                            );
                            const currentValue = row?.featuredByEntitlement ?? false;

                            if (!currentValue) {
                                logger.info(
                                    'featured-by-entitlement-reconcile: addon drift detected, correcting',
                                    { ownerId, accommodationId, dryRun }
                                );

                                if (dryRun) {
                                    correctedAddonAccommodations++;
                                } else {
                                    const { updated } =
                                        await syncFeaturedByEntitlementForAccommodation({
                                            accommodationId,
                                            active: true,
                                            ownerId
                                        });
                                    correctedAddonAccommodations++;
                                    totalRowsUpdated += updated;
                                }
                            }
                        }
                    }
                } catch (ownerError) {
                    errors++;
                    const message =
                        ownerError instanceof Error ? ownerError.message : String(ownerError);
                    logger.warn(
                        'featured-by-entitlement-reconcile: error processing owner (skipping)',
                        { ownerId, error: message }
                    );
                }
            }

            // Step 3 (HOS-1286): the two COMMERCE verticals.
            //
            // Deliberately NOT the owner walk above. Accommodation has to walk
            // owners because a PLAN can grant featuring owner-wide, so the
            // expected value of a row cannot be read off the grant table alone.
            // No commerce plan grants FEATURED_LISTING, so for gastronomy and
            // experience the live grants ARE the complete set of listings that
            // should be flagged — which makes this a two-way set difference
            // instead of a per-owner query.
            //
            // Both directions matter and neither is redundant with the other:
            // a listing holding a live grant but flagged `false` lost a purchase
            // hook; a listing flagged `true` with no live grant is a boost that
            // expired and never got cleared, i.e. product given away for free.
            for (const entityType of COMMERCE_FEATURED_VERTICALS) {
                try {
                    const table = commerceTable(entityType);

                    const shouldBeFeatured = new Set(
                        await getActiveFeaturedGrantEntityIds({ entityType })
                    );

                    const flaggedRows = await db
                        .select({ id: table.id })
                        .from(table)
                        .where(and(eq(table.featuredByEntitlement, true), isNull(table.deletedAt)));
                    const currentlyFlagged = new Set(flaggedRows.map((row) => row.id));

                    const toSet = [...shouldBeFeatured].filter((id) => !currentlyFlagged.has(id));
                    const toClear = [...currentlyFlagged].filter((id) => !shouldBeFeatured.has(id));

                    for (const entityId of [...toSet, ...toClear]) {
                        const active = shouldBeFeatured.has(entityId);
                        logger.info(
                            'featured-by-entitlement-reconcile: commerce drift detected, correcting',
                            { entityType, entityId, active, dryRun }
                        );

                        if (dryRun) {
                            correctedCommerceListings++;
                            continue;
                        }

                        const { updated } = await syncFeaturedByEntitlementForCommerceListing({
                            entityType,
                            entityId,
                            active
                        });
                        correctedCommerceListings++;
                        totalRowsUpdated += updated;
                    }
                } catch (commerceError) {
                    errors++;
                    logger.warn(
                        'featured-by-entitlement-reconcile: error processing commerce vertical (skipping)',
                        {
                            entityType,
                            error:
                                commerceError instanceof Error
                                    ? commerceError.message
                                    : String(commerceError)
                        }
                    );
                }
            }
            const durationMs = Date.now() - startedAt.getTime();

            logger.info('featured-by-entitlement-reconcile: completed', {
                totalOwners: ownerIds.length,
                correctedPlanOwners,
                correctedAddonAccommodations,
                correctedCommerceListings,
                totalRowsUpdated,
                errors,
                durationMs,
                dryRun
            });

            return {
                success: true,
                message: dryRun
                    ? `Dry run — ${correctedPlanOwners} owner(s) + ${correctedAddonAccommodations} accommodation(s) + ${correctedCommerceListings} commerce listing(s) would be corrected`
                    : `Corrected ${correctedPlanOwners} owner(s) (plan) + ${correctedAddonAccommodations} accommodation(s) (addon) + ${correctedCommerceListings} commerce listing(s), ${totalRowsUpdated} row(s) updated`,
                processed: ownerIds.length,
                errors,
                durationMs,
                details: {
                    totalOwners: ownerIds.length,
                    correctedPlanOwners,
                    correctedAddonAccommodations,
                    correctedCommerceListings,
                    totalRowsUpdated,
                    dryRun
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            errors++;

            // Fatal failure (e.g. DB not initialized, selectDistinct threw) →
            // forward to Sentry so it is actionable.
            logger.error(
                'featured-by-entitlement-reconcile: fatal error',
                { error: errorMessage, stack: errorStack },
                { capture: true }
            );

            const durationMs = Date.now() - startedAt.getTime();

            return {
                success: false,
                message: `Reconciliation failed: ${errorMessage}`,
                processed: 0,
                errors,
                durationMs,
                details: { error: errorMessage }
            };
        }
    }
};
