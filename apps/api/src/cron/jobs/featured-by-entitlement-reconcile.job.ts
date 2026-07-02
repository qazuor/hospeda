/**
 * Featured-By-Entitlement Reconciliation Cron Job (SPEC-309 T-014, renamed +
 * extended from SPEC-292 T-006).
 *
 * Backstop that corrects drift between `accommodations.featuredByEntitlement`
 * and its TWO independent sources of truth (SPEC-309 OQ-3):
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
 * 3. Log corrected-count separately per source (plan vs addon) for
 *    observability.
 *
 * @module cron/jobs/featured-by-entitlement-reconcile
 */

import { accommodations, and, eq, getDb, isNull } from '@repo/db';
import {
    getOwnerAccommodationIdsWithActiveFeaturedAddon,
    resolveOwnerPlanGrantsFeatured,
    syncFeaturedByEntitlementForAccommodation,
    syncFeaturedByEntitlementForOwner
} from '@repo/service-core';
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

            const durationMs = Date.now() - startedAt.getTime();

            logger.info('featured-by-entitlement-reconcile: completed', {
                totalOwners: ownerIds.length,
                correctedPlanOwners,
                correctedAddonAccommodations,
                totalRowsUpdated,
                errors,
                durationMs,
                dryRun
            });

            return {
                success: true,
                message: dryRun
                    ? `Dry run — ${correctedPlanOwners} owner(s) + ${correctedAddonAccommodations} accommodation(s) would be corrected`
                    : `Corrected ${correctedPlanOwners} owner(s) (plan) + ${correctedAddonAccommodations} accommodation(s) (addon), ${totalRowsUpdated} row(s) updated`,
                processed: ownerIds.length,
                errors,
                durationMs,
                details: {
                    totalOwners: ownerIds.length,
                    correctedPlanOwners,
                    correctedAddonAccommodations,
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
