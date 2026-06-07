/**
 * Shared Downgrade Remediation Service (SPEC-167 T-011).
 *
 * `applyDowngradeRestrictions` is the CENTERPIECE that coordinates the full
 * downgrade-apply restriction flow. It is called from two places:
 *   1. The `apply-scheduled-plan-changes` cron (T-013) at period-end.
 *   2. The admin `onAfterSubscriptionChangePlan` hook (T-014) for immediate
 *      admin-triggered plan changes (design decision 5).
 *
 * **Algorithm (per run):**
 *   1. Recompute excess FRESH via `computeDowngradeExcess` (spec §4.4).
 *      Usage may have changed since the downgrade was scheduled.
 *   2. Merge host keepSelections with the default keep list:
 *      - Valid ids (present in the fresh preview items) override the default.
 *      - Stale ids (not found in current items) are silently dropped.
 *      - Over-cap selections are truncated using the default sort order
 *        (keepByDefault band from computeDowngradeExcess).
 *   3. Execute primitives inside a single Drizzle transaction:
 *      - `restrictAccommodations` for excess accommodations.
 *      - `restrictPromotions` for excess promotions.
 *      - `archiveAccommodationPhotos` per accommodation with photo excess.
 *      Partial failure inside the tx rolls back the entire operation — no
 *      partial state is left behind (INV-5).
 *   4. AFTER the tx commits: schedule batch revalidation for every touched
 *      accommodation. Side effects (revalidation, notifications) never go
 *      inside the tx because they cannot be rolled back.
 *   5. Return a structured {@link DowngradeRemediationSummary}.
 *
 * **Idempotency:**
 *   If all dimensions are already within cap (because a prior run restricted
 *   the excess), `computeDowngradeExcess` returns zero excess and the function
 *   exits immediately without calling any primitive.
 *
 * **Grandfather flags:**
 *   Rich description and video embed detections are included in the summary
 *   for informational purposes only. No action is taken on them (spec §3).
 *
 * **Selection merge semantics / truncation:**
 *   For each dimension (accommodations, promotions), the merge logic is:
 *   ```
 *   validSelections = provided keepIds ∩ ids in current excess items
 *   if validSelections.length > cap:
 *     // truncate: keep only items that fall in the default keepByDefault band
 *     keep = first cap items from the default keepByDefault=true band
 *   else if validSelections.length > 0:
 *     keep = validSelections
 *   else:
 *     keep = default (keepByDefault=true items from the fresh preview)
 *   restrict = all excess items NOT in keep
 *   ```
 *
 * **Photo keepIds:**
 *   When `keepSelections.photoKeepMap[accommodationId]` is provided, those
 *   URLs are passed as keepIds to `archiveAccommodationPhotos`.
 *   For the default path, the coordinator reads the accommodation's current
 *   gallery inside the tx and builds keepIds = gallery MINUS overflowPhotoUrls.
 *
 * Slightly over the 500-line guideline; split deferred (reviewed SPEC-167 T-023).
 *
 * @module services/plan-downgrade-remediation
 */

import type { DrizzleClient } from '@repo/db';
import { withTransaction } from '@repo/db';
import type { DowngradePreview, KeepSelections } from '@repo/schemas';
import { getRevalidationService } from '@repo/service-core';
import type { EntityChangeData } from '@repo/service-core';
import { apiLogger } from '../utils/logger';
import { archiveAccommodationPhotos } from './plan-photo-restriction.service';
import { restrictAccommodations, restrictPromotions } from './plan-restriction.service';
import type { ComputeDowngradeExcessDeps } from './subscription-downgrade-excess.service';
import { computeDowngradeExcess } from './subscription-downgrade-excess.service';

// ---------------------------------------------------------------------------
// Input / output contracts
// ---------------------------------------------------------------------------

/**
 * External dependencies injected into {@link applyDowngradeRestrictions}.
 * Provided as a DI record for unit-testability.
 */
export interface DowngradeRemediationDeps {
    /**
     * Computes the current per-dimension excess for the host vs. target plan.
     * Production: wraps `computeDowngradeExcess` with `defaultExcessDeps`.
     * Tests: mock returning a {@link DowngradePreview}.
     */
    computeExcess(params: {
        userId: string;
        targetPlanSlug: string;
        deps?: ComputeDowngradeExcessDeps;
    }): Promise<DowngradePreview>;

    /**
     * Fetches accommodation slugs for a list of accommodation IDs.
     * Used to build complete {@link EntityChangeData} events for revalidation.
     * Returns a map `accommodationId → slug`. Missing/deleted ids are omitted.
     */
    fetchAccommodationSlugs(ids: readonly string[]): Promise<Record<string, string>>;
}

/**
 * Input for {@link applyDowngradeRestrictions}.
 */
export interface ApplyDowngradeRestrictionsInput {
    /**
     * The internal user/owner ID used to query active accommodations and
     * promotions (`ownerId` in the DB). This is the `userId` field that
     * `computeDowngradeExcess` expects.
     */
    readonly userId: string;
    /**
     * The billing customer ID (used for log attribution only).
     */
    readonly customerId: string;
    /** Slug of the plan the host is downgrading TO. */
    readonly targetPlanSlug: string;
    /**
     * Optional keep selections persisted with the scheduled change.
     * When absent or partially absent, the default sort order from
     * `computeDowngradeExcess` is used for the missing dimensions.
     */
    readonly keepSelections?: KeepSelections;
    /**
     * Optional Drizzle client. When provided, restriction primitives reuse
     * this client. Production callers typically omit this; the service opens
     * its own transaction via `withTransaction`.
     */
    readonly db?: DrizzleClient;
    /**
     * Injected dependencies. Defaults to production implementations when
     * omitted.
     */
    readonly deps?: DowngradeRemediationDeps;
}

/**
 * Per-dimension restriction counts in the remediation summary.
 */
export interface DowngradeRemediationRestricted {
    /** IDs of accommodations set to `planRestricted = true`. */
    readonly accommodations: readonly string[];
    /** IDs of promotions set to `planRestricted = true`. */
    readonly promotions: readonly string[];
    /**
     * Per-accommodation photo archive counts.
     * Key = accommodation ID, value = number of gallery items moved to
     * `archivedGallery`.
     */
    readonly photosByAccommodation: Readonly<Record<string, number>>;
}

/**
 * Tracks which items were kept and WHY (selection vs. default).
 */
export interface DowngradeRemediationKept {
    /**
     * IDs of accommodations/promotions kept because the host explicitly
     * selected them.
     */
    readonly accommodations: readonly string[];
    readonly promotions: readonly string[];
}

/**
 * Structured summary returned by {@link applyDowngradeRestrictions}.
 * Consumed by T-017 notifications and the cron job log.
 */
export interface DowngradeRemediationSummary {
    /** Items restricted in this run. Empty on idempotent re-runs. */
    readonly restricted: DowngradeRemediationRestricted;
    /** Items kept because the host explicitly selected them. */
    readonly keptBySelection: DowngradeRemediationKept;
    /** Items kept because they were in the default keep band. */
    readonly keptByDefault: DowngradeRemediationKept;
    /**
     * Grandfather content flags — informational only, no restriction taken.
     */
    readonly grandfatherFlags: DowngradePreview['grandfatherFlags'];
}

// ---------------------------------------------------------------------------
// Default production dependencies
// ---------------------------------------------------------------------------

const defaultDeps: DowngradeRemediationDeps = {
    async computeExcess({ userId, targetPlanSlug }) {
        const { defaultExcessDeps } = await import('./subscription-downgrade-excess.service');
        return computeDowngradeExcess({ userId, targetPlanSlug }, defaultExcessDeps);
    },

    async fetchAccommodationSlugs(ids) {
        if (ids.length === 0) return {};
        const { accommodationModel } = await import('@repo/db');
        const rows = await accommodationModel.findAll(
            { id: { in: ids as string[] } },
            { pageSize: ids.length + 10 }
        );
        const map: Record<string, string> = {};
        for (const row of rows.items ?? []) {
            if (row.id && row.slug) map[row.id] = row.slug;
        }
        return map;
    }
};

// ---------------------------------------------------------------------------
// Selection merge helper
// ---------------------------------------------------------------------------

/**
 * Resolves the final keep set for a dimension given the fresh excess preview
 * items and optional host-provided keep ids.
 *
 * Merge rules (documented in module JSDoc):
 *  1. Validate: intersect selectedIds with current item ids. Drop unknowns.
 *  2. Cap: if valid > cap, truncate using default keepByDefault band.
 *  3. Fallback: empty valid selection → use default keepByDefault items.
 *
 * @returns keepIds (Set), fromSelection (kept via host selection), fromDefault (kept by default).
 */
function resolveKeepIds(params: {
    readonly items: ReadonlyArray<{ id: string; keepByDefault: boolean }>;
    readonly cap: number;
    readonly selectedIds?: readonly string[];
}): {
    readonly keepIds: ReadonlySet<string>;
    readonly fromSelection: readonly string[];
    readonly fromDefault: readonly string[];
} {
    const { items, cap, selectedIds } = params;

    const allItemIds = new Set(items.map((i) => i.id));
    const defaultKeep = items.filter((i) => i.keepByDefault).map((i) => i.id);

    // No excess: cap >= total items — keep everything
    if (cap >= items.length || items.length === 0) {
        return { keepIds: allItemIds, fromSelection: [], fromDefault: [...allItemIds] };
    }

    // Validate: drop stale ids
    const valid = selectedIds?.filter((id) => allItemIds.has(id)) ?? [];

    if (valid.length === 0) {
        // Full fallback to default
        const keepIds = new Set(defaultKeep.slice(0, cap));
        return { keepIds, fromSelection: [], fromDefault: [...keepIds] };
    }

    if (valid.length > cap) {
        // Over-cap: truncate using default ordering.
        // Keep only selected ids that fall in the default keepByDefault band.
        const defaultBand = new Set(defaultKeep.slice(0, cap));
        const truncated = valid.filter((id) => defaultBand.has(id)).slice(0, cap);

        if (truncated.length === 0) {
            // No overlap between selection and default band → full default fallback
            const keepIds = new Set(defaultKeep.slice(0, cap));
            return { keepIds, fromSelection: [], fromDefault: [...keepIds] };
        }

        // Fill remaining slots from default band to reach cap.
        // Track which ids came from the host's selection vs. which were
        // filled in from the default band (they are distinct categories:
        // the host did not explicitly request the default-filled slots).
        const keepIds = new Set(truncated);
        const defaultFilled: string[] = [];
        for (const id of defaultKeep) {
            if (keepIds.size >= cap) break;
            if (!keepIds.has(id)) {
                keepIds.add(id);
                defaultFilled.push(id);
            }
        }
        return { keepIds, fromSelection: truncated, fromDefault: defaultFilled };
    }

    // Valid selection within cap
    const keepIds = new Set(valid);
    return { keepIds, fromSelection: valid, fromDefault: [] };
}

// ---------------------------------------------------------------------------
// Photo keepIds builder
// ---------------------------------------------------------------------------

/**
 * Reads the current gallery for an accommodation within an active transaction
 * and returns keepIds = gallery URLs MINUS the overflow set.
 *
 * Used for the default photo-restriction path when no `photoKeepMap` is
 * provided by the host. The overflow URLs from the excess preview are archived;
 * everything else stays in the gallery.
 */
async function buildDefaultPhotoKeepIds(params: {
    readonly accommodationId: string;
    readonly overflowUrls: ReadonlySet<string>;
    readonly tx: DrizzleClient;
}): Promise<Set<string>> {
    const { accommodationId, overflowUrls, tx } = params;
    try {
        const { accommodations: accommodationsTable, eq, isNull, and } = await import('@repo/db');
        const [row] = await tx
            .select({ media: accommodationsTable.media })
            .from(accommodationsTable)
            .where(
                and(
                    eq(accommodationsTable.id, accommodationId),
                    isNull(accommodationsTable.deletedAt)
                )
            );

        if (!row?.media) return new Set<string>();
        const media = row.media as { gallery?: Array<{ url: string }> };
        return new Set(
            (media.gallery ?? []).filter((img) => !overflowUrls.has(img.url)).map((img) => img.url)
        );
    } catch {
        // Fallback: empty keepIds archives everything (still reversible per INV-5)
        return new Set<string>();
    }
}

// ---------------------------------------------------------------------------
// Destination recount helper
// ---------------------------------------------------------------------------

/**
 * After bulk accommodation restriction or restoration, recount accommodations
 * per affected destination so `destination.accommodationsCount` stays accurate.
 *
 * Uses `DestinationService.updateAccommodationsCount` which applies the correct
 * public-visibility predicate (ACTIVE + not ownerSuspended + not planRestricted).
 *
 * Called AFTER the transaction commits (side-effect, cannot roll back).
 *
 * @param accommodationIds - IDs of accommodations that were restricted/restored.
 */
async function triggerDestinationRecounts(accommodationIds: readonly string[]): Promise<void> {
    if (accommodationIds.length === 0) return;
    try {
        const { accommodations: accsTable, getDb } = await import('@repo/db');
        const { inArray } = await import('drizzle-orm');
        const { DestinationService } = await import('@repo/service-core');
        // Direct inArray query — accommodationModel.findAll does NOT support the
        // `{ id: { in: [...] } }` operator (buildWhereClause throws on plain objects).
        const rows = await getDb()
            .select({ id: accsTable.id, destinationId: accsTable.destinationId })
            .from(accsTable)
            .where(inArray(accsTable.id, accommodationIds as string[]));
        const destinationIds = [
            ...new Set(
                rows
                    .map((r) => r.destinationId)
                    .filter((id): id is string => typeof id === 'string' && id.length > 0)
            )
        ];
        if (destinationIds.length === 0) return;
        const destinationService = new DestinationService({ logger: apiLogger });
        await Promise.all(
            destinationIds.map((destId) => destinationService.updateAccommodationsCount(destId))
        );
        apiLogger.info(
            { destinationIds, accommodationCount: accommodationIds.length },
            'plan-downgrade-remediation: destination accommodation counts updated'
        );
    } catch (err) {
        // Non-blocking: recount failure must not roll back the restriction.
        apiLogger.warn(
            { err, accommodationIds },
            'plan-downgrade-remediation: destination recount failed (non-blocking)'
        );
    }
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Apply downgrade restrictions for a host transitioning to a lower plan.
 *
 * Recomputes excess fresh, merges host selections with defaults, restricts
 * excess resources in a single transaction, and schedules cache revalidation
 * after the transaction commits.
 *
 * **Idempotent**: if `computeDowngradeExcess` reports zero excess (because a
 * prior run already restricted everything), returns immediately with an empty
 * summary and no primitive calls are made.
 *
 * **Transaction boundary:**
 * - INSIDE tx: `restrictAccommodations`, `restrictPromotions`,
 *   `archiveAccommodationPhotos`. All DB mutations are atomic.
 * - AFTER tx: `scheduleRevalidationBatch`. Side effects are fire-and-forget
 *   and must not run if the tx fails.
 *
 * @param input - Host identity, target plan, optional selections, optional db.
 * @returns A {@link DowngradeRemediationSummary}.
 * @throws {Error} When `userId` or `targetPlanSlug` is empty.
 * @throws Re-throws any error from `computeDowngradeExcess` or primitives.
 *
 * @example
 * ```ts
 * const summary = await applyDowngradeRestrictions({
 *   userId: customer.metadata.userId,
 *   customerId: customer.id,
 *   targetPlanSlug: 'owner-basico',
 *   keepSelections: getKeepSelectionsForChange(scheduledChange),
 * });
 * ```
 */
export async function applyDowngradeRestrictions(
    input: ApplyDowngradeRestrictionsInput
): Promise<DowngradeRemediationSummary> {
    const { userId, customerId, targetPlanSlug, keepSelections, db } = input;
    const deps = input.deps ?? defaultDeps;

    // ── Input validation ───────────────────────────────────────────────────
    if (!userId || userId.trim() === '') {
        throw new Error('applyDowngradeRestrictions: userId is required');
    }
    if (!targetPlanSlug || targetPlanSlug.trim() === '') {
        throw new Error('applyDowngradeRestrictions: targetPlanSlug is required');
    }

    apiLogger.info(
        { userId, customerId, targetPlanSlug },
        'plan-downgrade-remediation: starting restriction pass'
    );

    // ── 1. Fresh excess computation ────────────────────────────────────────
    const preview = await deps.computeExcess({ userId, targetPlanSlug });

    if (!preview.hasExcess) {
        apiLogger.info(
            { userId, customerId, targetPlanSlug },
            'plan-downgrade-remediation: no excess — idempotent no-op'
        );
        return {
            restricted: { accommodations: [], promotions: [], photosByAccommodation: {} },
            keptBySelection: { accommodations: [], promotions: [] },
            keptByDefault: { accommodations: [], promotions: [] },
            grandfatherFlags: preview.grandfatherFlags
        };
    }

    // ── 2. Resolve keep ids per dimension ─────────────────────────────────

    const accResolved = resolveKeepIds({
        items: preview.accommodations.items,
        cap: Math.max(0, preview.accommodations.cap),
        selectedIds: keepSelections?.accommodationIds
    });
    const accRestrictIds = preview.accommodations.items
        .map((i) => i.id)
        .filter((id) => !accResolved.keepIds.has(id));

    const promoResolved = resolveKeepIds({
        items: preview.promotions.items,
        cap: Math.max(0, preview.promotions.cap),
        selectedIds: keepSelections?.promotionIds
    });
    const promoRestrictIds = preview.promotions.items
        .map((i) => i.id)
        .filter((id) => !promoResolved.keepIds.has(id));

    // ── 3. Execute primitives in a transaction ────────────────────────────
    const restrictedAccIds: string[] = [];
    const restrictedPromoIds: string[] = [];
    const photosByAccommodation: Record<string, number> = {};

    await withTransaction(async (tx) => {
        // Accommodations
        if (accRestrictIds.length > 0) {
            const result = await restrictAccommodations({ ids: accRestrictIds, db: tx });
            restrictedAccIds.push(...result.affectedIds);
        }

        // Promotions
        if (promoRestrictIds.length > 0) {
            const result = await restrictPromotions({ ids: promoRestrictIds, db: tx });
            restrictedPromoIds.push(...result.affectedIds);
        }

        // Photos — one call per accommodation with photo excess
        for (const entry of preview.photos) {
            const hostUrls = keepSelections?.photoKeepMap?.[entry.accommodationId];
            let keepIds: Set<string>;

            if (hostUrls && hostUrls.length > 0) {
                // Host provided an explicit set of URLs to keep
                keepIds = new Set(hostUrls);
            } else {
                // Default path: keep = gallery minus overflow
                // Reads accommodation gallery within the active tx.
                keepIds = await buildDefaultPhotoKeepIds({
                    accommodationId: entry.accommodationId,
                    overflowUrls: new Set(entry.overflowPhotoUrls),
                    tx: tx as DrizzleClient
                });
            }

            const result = await archiveAccommodationPhotos({
                accommodationId: entry.accommodationId,
                keepIds,
                db: tx
            });

            if (result.movedCount > 0) {
                photosByAccommodation[entry.accommodationId] = result.movedCount;
            }
        }
    }, db);

    // ── 4a. Trigger destination recounts AFTER tx ────────────────────────
    // Restricted accommodations are now excluded from the public predicate,
    // so destination.accommodationsCount must be updated for every affected
    // destination. This runs AFTER the tx so it cannot block rollback.
    if (restrictedAccIds.length > 0) {
        await triggerDestinationRecounts(restrictedAccIds);
    }

    // ── 4b. Schedule revalidation AFTER tx ───────────────────────────────
    const allTouchedIds = [
        ...new Set([...restrictedAccIds, ...Object.keys(photosByAccommodation)])
    ];

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
                    reason: `plan-downgrade-remediation: ${targetPlanSlug}`
                });
            } catch (err) {
                apiLogger.warn(
                    { err, userId, customerId },
                    'plan-downgrade-remediation: revalidation scheduling failed (non-blocking)'
                );
            }
        }
    }

    // ── 5. Build summary ──────────────────────────────────────────────────
    apiLogger.info(
        {
            userId,
            customerId,
            targetPlanSlug,
            restrictedAccommodations: restrictedAccIds.length,
            restrictedPromotions: restrictedPromoIds.length,
            photoAccommodations: Object.keys(photosByAccommodation).length
        },
        'plan-downgrade-remediation: restriction pass complete'
    );

    return {
        restricted: {
            accommodations: restrictedAccIds,
            promotions: restrictedPromoIds,
            photosByAccommodation
        },
        keptBySelection: {
            accommodations: accResolved.fromSelection,
            promotions: promoResolved.fromSelection
        },
        keptByDefault: {
            accommodations: accResolved.fromDefault,
            promotions: promoResolved.fromDefault
        },
        grandfatherFlags: preview.grandfatherFlags
    };
}

/**
 * Soft-fail wrapper around {@link applyDowngradeRestrictions}.
 *
 * Used in the admin `onAfterSubscriptionChangePlan` hook where a restriction
 * failure must NOT break the admin response (the plan change has already
 * committed in QZPay). Errors are logged via `apiLogger.error` (the logger
 * integration reports to Sentry) and an empty summary is returned.
 *
 * @param input - Same as {@link applyDowngradeRestrictions}.
 * @returns A {@link DowngradeRemediationSummary} (empty on failure).
 */
export async function applyDowngradeRestrictionsOrWarn(
    input: ApplyDowngradeRestrictionsInput
): Promise<DowngradeRemediationSummary> {
    try {
        return await applyDowngradeRestrictions(input);
    } catch (err) {
        apiLogger.error(
            {
                userId: input.userId,
                customerId: input.customerId,
                targetPlanSlug: input.targetPlanSlug,
                error: err instanceof Error ? err.message : String(err)
            },
            'plan-downgrade-remediation: restriction failed — non-blocking, plan change already committed'
        );
        return {
            restricted: { accommodations: [], promotions: [], photosByAccommodation: {} },
            keptBySelection: { accommodations: [], promotions: [] },
            keptByDefault: { accommodations: [], promotions: [] },
            grandfatherFlags: []
        };
    }
}
