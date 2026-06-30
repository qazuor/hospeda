/**
 * Featured-By-Plan Reconciliation Cron Job (SPEC-292 T-006).
 *
 * Backstop that corrects drift between `accommodations.featuredByPlan` and the
 * source-of-truth FEATURED_LISTING billing entitlement for every host owner.
 * Runs every 6 hours to capture billing transitions (dunning retry_succeeded,
 * manual admin comp, reactivations, plan upgrades/downgrades) that the T-005
 * event hooks may have missed.
 *
 * ### Algorithm
 *
 * 1. Query distinct ownerIds from non-deleted accommodations (one DB round-trip).
 * 2. For each owner **sequentially** — no thundering herd against QZPay:
 *    a. Resolve the billing customer via `customers.getByExternalId(ownerId)`.
 *    b. Derive `shouldBeFeatured` from the owner's active accommodation
 *       subscription's plan entitlements. Mirrors `loadEntitlements()` in
 *       `entitlement.ts`: status ∈ {active, trialing, comp} +
 *       `isAccommodationSubscription` domain filter.
 *    c. Read the current `featuredByPlan` from one non-deleted accommodation
 *       row (all rows for an owner should be in the same state after a bulk
 *       sync, so sampling one is sufficient for drift detection).
 *    d. **Drift guard**: only call `syncFeaturedByPlan` when the DB state
 *       mismatches the resolved entitlement. Skip no-op writes to avoid
 *       unnecessary load on QZPay (cached 5 min) and the DB.
 * 3. Log corrected-owner count + total rows updated.
 *
 * ### What T-007 must assert
 *
 * - **Zero-drift no-write**: owner with correct `featuredByPlan` is visited but
 *   `syncFeaturedByPlan` is NOT called and the result `correctedOwners = 0`.
 * - **Drift-clear**: owner has `featuredByPlan = true` but no active
 *   FEATURED_LISTING entitlement → `syncFeaturedByPlan({ active: false })` is
 *   called and `correctedOwners = 1`.
 * - **Drift-set**: owner has `featuredByPlan = false` but holds a live
 *   FEATURED_LISTING entitlement → `syncFeaturedByPlan({ active: true })` is
 *   called and `correctedOwners = 1`.
 *
 * @module cron/jobs/featured-by-plan-reconcile
 */

import { EntitlementKey, isEntitlementKey } from '@repo/billing';
import { accommodations, and, eq, getDb, isNull } from '@repo/db';
import { isAccommodationSubscription, syncFeaturedByPlan } from '@repo/service-core';
import { getQZPayBilling } from '../../middlewares/billing.js';
import type { CronJobContext, CronJobDefinition } from '../types.js';

// ---------------------------------------------------------------------------
// Entitlement resolver
// ---------------------------------------------------------------------------

/**
 * Resolve whether an owner currently holds an active FEATURED_LISTING
 * entitlement. Standalone so the reconcile cron does not depend on the
 * request-scoped middleware context.
 *
 * Mirrors the entitlement resolution path in `entitlement.ts`:
 * - Active accommodation subscription statuses: `active`, `trialing`, `comp`.
 * - Domain filter: `isAccommodationSubscription` (SPEC-239 isolation).
 * - Fails open (returns `false`) when billing is unavailable, the customer
 *   row does not exist yet, or any lookup throws.
 *
 * @param ownerId - The `users.id` of the accommodation owner.
 * @param logger  - Cron context logger for warn-level diagnostics.
 * @returns `true` when the owner's accommodation plan includes
 *   FEATURED_LISTING; `false` in all other cases.
 */
async function resolveOwnerHasFeaturedListing(
    ownerId: string,
    logger: CronJobContext['logger']
): Promise<boolean> {
    const billing = getQZPayBilling();

    if (!billing) {
        return false;
    }

    try {
        // Step 1: translate users.id → QZPay customer id.
        const customer = await billing.customers.getByExternalId(ownerId);

        if (!customer?.id) {
            return false;
        }

        // Step 2: find an active accommodation subscription (mirrors entitlement.ts).
        const subscriptions = await billing.subscriptions.getByCustomerId(customer.id);

        if (!subscriptions || subscriptions.length === 0) {
            return false;
        }

        const activeSub = subscriptions.find(
            (sub: { status: string }) =>
                (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'comp') &&
                isAccommodationSubscription(sub)
        );

        if (!activeSub) {
            return false;
        }

        // Step 3: check plan entitlements for FEATURED_LISTING.
        const plan = await billing.plans.get(activeSub.planId);

        if (!plan?.entitlements) {
            return false;
        }

        return plan.entitlements.some(
            (key: string) => isEntitlementKey(key) && key === EntitlementKey.FEATURED_LISTING
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn('featured-by-plan-reconcile: entitlement lookup failed for owner', {
            ownerId,
            error: message
        });
        return false;
    }
}

// ---------------------------------------------------------------------------
// Job definition
// ---------------------------------------------------------------------------

/**
 * Featured-by-plan reconciliation cron job.
 *
 * Schedule: Every 6 hours (`0 *​/6 * * *`) — aligned with the cron-lag grace
 * period (BILLING_CRON_LAG_GRACE_HOURS = 6h per CLAUDE.md) so any billing
 * state that enters the grace window is caught before that window expires.
 *
 * Timeout: 10 minutes — generous for large installations; each owner makes at
 * most 3 QZPay API calls (customer + subscriptions + plan) which are cached for
 * 5 minutes at the QZPay layer. Processing is sequential to avoid overwhelming
 * the external billing API.
 */
export const featuredByPlanReconcileJob: CronJobDefinition = {
    name: 'featured-by-plan-reconcile',
    description:
        'Correct drift between accommodations.featuredByPlan and the FEATURED_LISTING billing entitlement (SPEC-292 T-006 backstop).',
    schedule: '0 */6 * * *',
    enabled: true,
    timeoutMs: 600_000, // 10 minutes

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('featured-by-plan-reconcile: starting', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        let correctedOwners = 0;
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

            logger.info('featured-by-plan-reconcile: owners to check', {
                count: ownerIds.length
            });

            // Step 2: process each owner sequentially (no QZPay thundering herd).
            for (const ownerId of ownerIds) {
                try {
                    // 2a: Resolve expected state from billing (QZPay, cached 5 min).
                    const shouldBeFeatured = await resolveOwnerHasFeaturedListing(ownerId, logger);

                    // 2b: Read current state from one non-deleted accommodation row.
                    const currentRows = await db
                        .select({ featuredByPlan: accommodations.featuredByPlan })
                        .from(accommodations)
                        .where(
                            and(
                                eq(accommodations.ownerId, ownerId),
                                isNull(accommodations.deletedAt)
                            )
                        )
                        .limit(1);

                    if (currentRows.length === 0) {
                        // Owner has no non-deleted accommodations — nothing to sync.
                        continue;
                    }

                    const currentFeaturedByPlan = currentRows[0]?.featuredByPlan ?? false;

                    // 2c: Drift guard — skip no-op writes.
                    if (currentFeaturedByPlan === shouldBeFeatured) {
                        continue;
                    }

                    logger.info('featured-by-plan-reconcile: drift detected, correcting', {
                        ownerId,
                        current: currentFeaturedByPlan,
                        expected: shouldBeFeatured,
                        dryRun
                    });

                    if (dryRun) {
                        // Dry run: count drift without writing.
                        correctedOwners++;
                    } else {
                        const { updated } = await syncFeaturedByPlan({
                            ownerId,
                            active: shouldBeFeatured
                        });
                        correctedOwners++;
                        totalRowsUpdated += updated;
                    }
                } catch (ownerError) {
                    errors++;
                    const message =
                        ownerError instanceof Error ? ownerError.message : String(ownerError);
                    logger.warn('featured-by-plan-reconcile: error processing owner (skipping)', {
                        ownerId,
                        error: message
                    });
                }
            }

            const durationMs = Date.now() - startedAt.getTime();

            logger.info('featured-by-plan-reconcile: completed', {
                totalOwners: ownerIds.length,
                correctedOwners,
                totalRowsUpdated,
                errors,
                durationMs,
                dryRun
            });

            return {
                success: true,
                message: dryRun
                    ? `Dry run — ${correctedOwners} owner(s) would be corrected`
                    : `Corrected ${correctedOwners} owner(s), ${totalRowsUpdated} row(s) updated`,
                processed: ownerIds.length,
                errors,
                durationMs,
                details: {
                    totalOwners: ownerIds.length,
                    correctedOwners,
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
                'featured-by-plan-reconcile: fatal error',
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
