/**
 * Plan Upgrade Restoration Service (SPEC-167 T-012).
 *
 * `applyUpgradeRestorations` is the inverse of `applyDowngradeRestrictions`
 * (T-011). When a host upgrades to a higher plan, any resources that were
 * previously plan-restricted (accommodations, promotions, archived gallery
 * photos) are restored up to the new plan's caps.
 *
 * **Algorithm (per run):**
 *   1. Resolve the new plan's caps via `deps.getPlanCaps(newPlanSlug)`.
 *   2. Per dimension: fetch currently-restricted items; compute headroom
 *      (headroom = cap - activeCount). Select the `headroom` most-recently-
 *      restricted items (descending `updatedAt`) for restoration. If cap is
 *      `-1` (unlimited), restore ALL restricted items.
 *   3. For photos: call `restoreAccommodationPhotos({ toCap: photoCap })`
 *      per accommodation that has archived photos AND is not still planRestricted
 *      after step 2 (n-2: skip photo restore for accommodations that remain
 *      restricted — they are hidden so restoring photos is wasteful and could
 *      over-fill the effective cap). The primitive handles FIFO ordering and
 *      the featuredImage seat reservation (M-3: toCap is the TOTAL cap).
 *   4. Execute all mutations inside a single Drizzle transaction.
 *   5. AFTER the tx commits: schedule batch revalidation for every
 *      accommodation that had accommodations or photos restored. Side effects
 *      (revalidation) never go inside the tx because they cannot be rolled back.
 *   6. Returns a structured {@link UpgradeRestorationSummary}.
 *
 * **Restore order:**
 *   Items are restored most-recently-restricted first (descending `updatedAt`).
 *   In practice, batch restriction (e.g. from the cron) sets near-identical
 *   `updatedAt` values for all items restricted in the same run — the ordering
 *   within a batch is therefore effectively arbitrary (DB tie-breaking), not a
 *   reliable recency signal. The stated intent (re-surface most-recently-visible
 *   items first) holds for items restricted in distinct runs but NOT within a
 *   single batch. Hosts who need precise control over which items are restored
 *   can use the manual swap UI (SPEC-203). Ties in `updatedAt` are broken
 *   arbitrarily (DB ordering).
 *
 * **Partial restore at cap:**
 *   When `headroom < restrictedCount`, only `headroom` items are restored and
 *   the rest remain in `stillRestricted`. The host can manually swap them later
 *   once SPEC-203 self-serve UI is available.
 *
 * **Idempotent:**
 *   If no dimension has restricted items, all primitive calls are skipped.
 *
 * **Transaction boundary:**
 * - INSIDE tx: `restoreAccommodations`, `restorePromotions`,
 *   `restoreAccommodationPhotos`. All DB mutations are atomic.
 * - AFTER tx: `scheduleRevalidationBatch`. Fire-and-forget, never inside tx.
 *
 * **Soft-fail wrapper (`applyUpgradeRestorationsOrWarn`):**
 *   Wraps the main function for the webhook/upgrade-success path. Restoration
 *   failure must NOT block the upgrade (the plan change already committed in
 *   QZPay). Errors are logged via `apiLogger.error` (triggers Sentry via the
 *   logger integration) and an empty summary is returned.
 * Production deps (DB/billing wiring) live in `plan-upgrade-restoration.deps.ts`.
 */

import type { DrizzleClient } from '@repo/db';
import { withTransaction } from '@repo/db';
import { getRevalidationService } from '@repo/service-core';
import type { EntityChangeData } from '@repo/service-core';
import { apiLogger } from '../utils/logger';
import { restoreAccommodationPhotos } from './plan-photo-restriction.service';
import { restoreAccommodations, restorePromotions } from './plan-restriction.service';
import { defaultDeps, splitByHeadroom } from './plan-upgrade-restoration.deps';

// ---------------------------------------------------------------------------
// Input / output contracts
// ---------------------------------------------------------------------------

/**
 * Per-dimension restricted item shape (minimal — only id + updatedAt needed
 * for sort ordering).
 */
export interface RestrictedItem {
    readonly id: string;
    readonly updatedAt: Date;
}

/**
 * Accommodation with archived gallery photos shape.
 */
export interface AccommodationWithArchivedPhotos {
    readonly accommodationId: string;
    /** Current gallery item count (excludes archived). */
    readonly galleryCount: number;
    /** Number of items currently in archivedGallery. */
    readonly archivedCount: number;
}

/**
 * Plan caps resolved for the upgrade target plan.
 * A value of `-1` means unlimited (no cap enforced).
 */
export interface PlanCaps {
    readonly accommodationsCap: number;
    readonly promotionsCap: number;
    readonly photosPerAccommodationCap: number;
}

/**
 * External dependencies injected into {@link applyUpgradeRestorations}.
 * Provided as a DI record for unit-testability.
 */
export interface UpgradeRestorationDeps {
    /**
     * Resolves the plan slug for a billing plan UUID.
     * Production: looks up `billingPlans.name` from the DB via `billing.plans.get(id)`.
     */
    getPlanSlug(planId: string): Promise<string | null>;

    /**
     * Returns the caps for the given plan slug.
     * Production: wraps `getPlanBySlug` from `@repo/billing`.
     * Returns { -1, -1, -1 } when the slug is not found (treat as unlimited).
     */
    getPlanCaps(planSlug: string): PlanCaps;

    /**
     * Fetches all accommodations with `planRestricted = true` owned by userId,
     * ordered by `updatedAt` DESC (most-recently-restricted first).
     */
    getRestrictedAccommodations(userId: string): Promise<RestrictedItem[]>;

    /**
     * Returns the count of NON-restricted active accommodations for the user.
     * Used to compute headroom (cap - activeCount).
     */
    getActiveAccommodationCount(userId: string): Promise<number>;

    /**
     * Fetches all promotions with `planRestricted = true` owned by userId,
     * ordered by `updatedAt` DESC (most-recently-restricted first).
     */
    getRestrictedPromotions(userId: string): Promise<RestrictedItem[]>;

    /**
     * Returns the count of NON-restricted active promotions for the user.
     */
    getActivePromotionCount(userId: string): Promise<number>;

    /**
     * Fetches accommodations owned by userId that have non-empty
     * `media.archivedGallery`, with their current gallery and archived counts.
     */
    getAccommodationsWithArchivedPhotos(userId: string): Promise<AccommodationWithArchivedPhotos[]>;

    /**
     * Fetches accommodation slugs for revalidation events.
     * Returns a map `accommodationId → slug`.
     */
    fetchAccommodationSlugs(ids: readonly string[]): Promise<Record<string, string>>;
}

/**
 * Input for {@link applyUpgradeRestorations}.
 */
export interface ApplyUpgradeRestorationsInput {
    /** The internal user/owner ID. */
    readonly userId: string;
    /** The billing customer ID (for log attribution only). */
    readonly customerId: string;
    /** The billing plan UUID the subscription has just been upgraded TO. */
    readonly newPlanId: string;
    /**
     * Optional Drizzle client. Production callers typically omit this;
     * the service opens its own transaction via `withTransaction`.
     */
    readonly db?: DrizzleClient;
    /**
     * Injected dependencies. Defaults to production implementations when omitted.
     */
    readonly deps?: UpgradeRestorationDeps;
}

/**
 * Per-dimension counts in the restoration summary.
 */
export interface UpgradeRestorationCounts {
    /** IDs restored in this run. */
    readonly accommodations: readonly string[];
    /** IDs of promotions restored in this run. */
    readonly promotions: readonly string[];
    /**
     * Per-accommodation photo restore counts.
     * Key = accommodation ID, value = number of items moved from archivedGallery to gallery.
     */
    readonly photosByAccommodation: Readonly<Record<string, number>>;
}

/**
 * Structured summary returned by {@link applyUpgradeRestorations}.
 */
export interface UpgradeRestorationSummary {
    /**
     * Items restored in this run. Empty arrays when nothing was restricted
     * (idempotent no-op).
     */
    readonly restored: UpgradeRestorationCounts;
    /**
     * Items that remain restricted after this run because the new plan's cap
     * still limits them (partial restore). The host can manually swap them
     * later once SPEC-203 self-serve UI is available.
     */
    readonly stillRestricted: {
        readonly accommodations: readonly string[];
        readonly promotions: readonly string[];
    };
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Apply upgrade restorations for a host transitioning to a higher plan.
 *
 * Resolves new plan caps, restores restricted resources up to the new cap
 * (most-recently-restricted first), and schedules cache revalidation after
 * the transaction commits.
 *
 * **Idempotent**: if no restricted items exist, returns immediately with an
 * empty summary and no primitive calls are made.
 *
 * **Transaction boundary:**
 * - INSIDE tx: `restoreAccommodations`, `restorePromotions`,
 *   `restoreAccommodationPhotos`. All DB mutations are atomic.
 * - AFTER tx: `scheduleRevalidationBatch`. Side effects are fire-and-forget
 *   and must not run if the tx fails.
 *
 * @param input - Host identity, new plan id, optional db, optional deps.
 * @returns A {@link UpgradeRestorationSummary}.
 * @throws {Error} When `userId` or `newPlanId` is empty.
 * @throws Re-throws primitive errors (wrap with {@link applyUpgradeRestorationsOrWarn}
 *   in the upgrade webhook path where failures must not block the response).
 *
 * @example
 * ```ts
 * const summary = await applyUpgradeRestorations({
 *   userId: changeResult.subscription.customerId,
 *   customerId: changeResult.subscription.customerId,
 *   newPlanId: changeResult.subscription.planId,
 * });
 * ```
 */
export async function applyUpgradeRestorations(
    input: ApplyUpgradeRestorationsInput
): Promise<UpgradeRestorationSummary> {
    const { userId, customerId, newPlanId, db } = input;
    const deps = input.deps ?? defaultDeps;

    // ── Input validation ────────────────────────────────────────────────────
    if (!userId || userId.trim() === '') {
        throw new Error('applyUpgradeRestorations: userId is required');
    }
    if (!newPlanId || newPlanId.trim() === '') {
        throw new Error('applyUpgradeRestorations: newPlanId is required');
    }

    apiLogger.info(
        { userId, customerId, newPlanId },
        'plan-upgrade-restoration: starting restoration pass'
    );

    // ── 1. Resolve plan caps ────────────────────────────────────────────────
    const planSlug = await deps.getPlanSlug(newPlanId);
    const caps = deps.getPlanCaps(planSlug ?? '');

    // ── 2. Fetch restricted items per dimension ─────────────────────────────
    const [
        restrictedAccs,
        activeAccCount,
        restrictedPromos,
        activePromoCount,
        accsWithArchivedPhotos
    ] = await Promise.all([
        deps.getRestrictedAccommodations(userId),
        deps.getActiveAccommodationCount(userId),
        deps.getRestrictedPromotions(userId),
        deps.getActivePromotionCount(userId),
        deps.getAccommodationsWithArchivedPhotos(userId)
    ]);

    const hasAnything =
        restrictedAccs.length > 0 ||
        restrictedPromos.length > 0 ||
        accsWithArchivedPhotos.length > 0;

    if (!hasAnything) {
        apiLogger.info(
            { userId, customerId, newPlanId },
            'plan-upgrade-restoration: nothing restricted — idempotent no-op'
        );
        return {
            restored: { accommodations: [], promotions: [], photosByAccommodation: {} },
            stillRestricted: { accommodations: [], promotions: [] }
        };
    }

    // ── 3. Compute what to restore per dimension ────────────────────────────
    const { toRestore: accRestoreIds, toLeave: accLeaveIds } = splitByHeadroom({
        restricted: restrictedAccs,
        cap: caps.accommodationsCap,
        activeCount: activeAccCount
    });

    const { toRestore: promoRestoreIds, toLeave: promoLeaveIds } = splitByHeadroom({
        restricted: restrictedPromos,
        cap: caps.promotionsCap,
        activeCount: activePromoCount
    });

    // ── 4. Execute mutations in a transaction ──────────────────────────────
    const restoredAccIds: string[] = [];
    const restoredPromoIds: string[] = [];
    const photosByAccommodation: Record<string, number> = {};

    await withTransaction(async (tx) => {
        // Accommodations
        if (accRestoreIds.length > 0) {
            const result = await restoreAccommodations({
                ids: accRestoreIds,
                db: tx as DrizzleClient
            });
            restoredAccIds.push(...result.affectedIds);
        }

        // Promotions
        if (promoRestoreIds.length > 0) {
            const result = await restorePromotions({
                ids: promoRestoreIds,
                db: tx as DrizzleClient
            });
            restoredPromoIds.push(...result.affectedIds);
        }

        // Photos — restore up to cap per accommodation.
        // n-2: skip photo restore for accommodations that remain planRestricted
        // after the accommodation-restore pass. Restoring photos for a still-
        // restricted accommodation wastes writes and can over-fill the effective
        // cap (a restricted accommodation is hidden, so its photos aren't visible
        // anyway). Skip the restore AND the revalidation event for those.
        const accLeaveSet = new Set(accLeaveIds);
        for (const acc of accsWithArchivedPhotos) {
            if (accLeaveSet.has(acc.accommodationId)) {
                // Accommodation remains restricted — skip photo restore.
                apiLogger.info(
                    { accommodationId: acc.accommodationId },
                    'plan-upgrade-restoration: skipping photo restore — acc still planRestricted (n-2)'
                );
                continue;
            }

            const toCap =
                caps.photosPerAccommodationCap === -1
                    ? acc.galleryCount + acc.archivedCount // restore all = total
                    : caps.photosPerAccommodationCap;

            const result = await restoreAccommodationPhotos({
                accommodationId: acc.accommodationId,
                toCap,
                db: tx as DrizzleClient
            });

            if (result.movedCount > 0) {
                photosByAccommodation[acc.accommodationId] = result.movedCount;
            }
        }
    }, db);

    // ── 4a. Trigger destination recounts AFTER tx ────────────────────────
    // Restored accommodations are now included in the public predicate,
    // so destination.accommodationsCount must be updated for every affected
    // destination. Non-blocking: recount failure must not block the caller.
    if (restoredAccIds.length > 0) {
        try {
            const { accommodationModel } = await import('@repo/db');
            const { DestinationService } = await import('@repo/service-core');
            const rows = await accommodationModel.findAll(
                { id: { in: restoredAccIds as string[] } },
                { pageSize: restoredAccIds.length + 10 }
            );
            const destinationIds = [
                ...new Set(
                    (rows.items ?? [])
                        .map((r: { destinationId?: string | null }) => r.destinationId)
                        .filter((id): id is string => typeof id === 'string' && id.length > 0)
                )
            ];
            if (destinationIds.length > 0) {
                const destinationService = new DestinationService({ logger: apiLogger });
                await Promise.all(
                    destinationIds.map((destId) =>
                        destinationService.updateAccommodationsCount(destId)
                    )
                );
                apiLogger.info(
                    { destinationIds, accommodationCount: restoredAccIds.length },
                    'plan-upgrade-restoration: destination accommodation counts updated'
                );
            }
        } catch (err) {
            apiLogger.warn(
                { err, userId },
                'plan-upgrade-restoration: destination recount failed (non-blocking)'
            );
        }
    }

    // ── 5. Schedule revalidation AFTER tx ──────────────────────────────────
    const allTouchedIds = [...new Set([...restoredAccIds, ...Object.keys(photosByAccommodation)])];

    if (allTouchedIds.length > 0) {
        const revalidationService = getRevalidationService();
        if (revalidationService) {
            try {
                const slugMap = await deps.fetchAccommodationSlugs(allTouchedIds);
                const events: EntityChangeData[] = allTouchedIds.map((id) => ({
                    entityType: 'accommodation' as const,
                    slug: slugMap[id] ?? id
                }));
                revalidationService.scheduleRevalidationBatch({
                    events,
                    reason: `plan-upgrade-restoration: ${planSlug ?? newPlanId}`
                });
            } catch (err) {
                apiLogger.warn(
                    { err, userId, customerId },
                    'plan-upgrade-restoration: revalidation scheduling failed (non-blocking)'
                );
            }
        }
    }

    // ── 6. Build summary ───────────────────────────────────────────────────
    apiLogger.info(
        {
            userId,
            customerId,
            newPlanId,
            planSlug,
            restoredAccommodations: restoredAccIds.length,
            restoredPromotions: restoredPromoIds.length,
            photoAccommodations: Object.keys(photosByAccommodation).length,
            stillRestrictedAccommodations: accLeaveIds.length,
            stillRestrictedPromotions: promoLeaveIds.length
        },
        'plan-upgrade-restoration: restoration pass complete'
    );

    return {
        restored: {
            accommodations: restoredAccIds,
            promotions: restoredPromoIds,
            photosByAccommodation
        },
        stillRestricted: {
            accommodations: accLeaveIds,
            promotions: promoLeaveIds
        }
    };
}

// ---------------------------------------------------------------------------
// Soft-fail wrapper for the upgrade webhook path
// ---------------------------------------------------------------------------

/**
 * Soft-fail wrapper around {@link applyUpgradeRestorations}.
 *
 * Used in the paid-upgrade webhook success path where a restoration failure
 * must NOT block the upgrade response (the plan change has already committed
 * in QZPay). Errors are logged via `apiLogger.error` (the logger integration
 * reports to Sentry) and an empty summary is returned.
 *
 * @param input - Same as {@link applyUpgradeRestorations}.
 * @returns A {@link UpgradeRestorationSummary} (empty on failure).
 */
export async function applyUpgradeRestorationsOrWarn(
    input: ApplyUpgradeRestorationsInput
): Promise<UpgradeRestorationSummary> {
    try {
        return await applyUpgradeRestorations(input);
    } catch (err) {
        apiLogger.error(
            {
                userId: input.userId,
                customerId: input.customerId,
                newPlanId: input.newPlanId,
                error: err instanceof Error ? err.message : String(err)
            },
            'plan-upgrade-restoration: restoration failed — non-blocking, upgrade already committed'
        );
        return {
            restored: { accommodations: [], promotions: [], photosByAccommodation: {} },
            stillRestricted: { accommodations: [], promotions: [] }
        };
    }
}
