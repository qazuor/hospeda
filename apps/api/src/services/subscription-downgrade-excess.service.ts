/**
 * Downgrade Excess Diff Helper (SPEC-167 T-006).
 *
 * `computeDowngradeExcess` is a READ-ONLY helper that computes per-dimension
 * usage vs. the target plan's limits and returns a structured
 * {@link DowngradePreview} describing what would be restricted if a
 * scheduled plan downgrade were applied right now.
 *
 * **Design decisions:**
 * - Default keep selection: most-recently-updated first (descending `updatedAt`).
 *   When two items share the same `updatedAt` timestamp the tiebreaker is
 *   `viewCount` descending (more views = higher value → kept). If `viewCount`
 *   is not available (caller passes `null` or the field is absent), `updatedAt`
 *   alone is used — no DB join is performed on behalf of the caller.
 * - Idempotency: items with `planRestricted: true` are excluded from the
 *   "active" counts. This means re-running the helper after a partial
 *   restriction (e.g. T-011 apply-time restriction) produces the correct
 *   residual excess, not a doubled count.
 * - Unlimited plans: a limit value of `-1` means "no cap". Any dimension with
 *   a `-1` limit always produces zero excess.
 * - Photo dimension: `featuredImage` always counts toward the cap but is never
 *   flagged as overflow (it is server-managed and always preserved). Only
 *   gallery items beyond (cap − 1 when featuredImage exists, or cap otherwise)
 *   are considered overflow.
 * - Grandfather flags (rich description / video embed): informational only.
 *   The detection logic uses `containsRichDescription` / `containsVideoEmbed`
 *   from `apps/api/src/lib/content-detection.ts`, the same shared module used
 *   by `gateRichDescription`/`gateVideoEmbed` in
 *   `apps/api/src/middlewares/accommodation-entitlements.ts`.
 *   When the target plan already grants `CAN_USE_RICH_DESCRIPTION` or
 *   `CAN_EMBED_VIDEO`, the corresponding flag is suppressed.
 * - Zero mutations: this function never writes to the database.
 * - Dependency injection via `ComputeDowngradeExcessDeps` for unit-testability.
 *
 * @module services/subscription-downgrade-excess
 */

import { EntitlementKey, LimitKey, getPlanBySlug as billingGetPlanBySlug } from '@repo/billing';
import type { PlanDefinition } from '@repo/billing';
import type {
    ComputeDowngradeExcessInput,
    DowngradeExcessItem,
    DowngradePreview
} from '@repo/schemas';
import { containsRichDescription, containsVideoEmbed } from '../lib/content-detection';

// ---------------------------------------------------------------------------
// Typed errors
// ---------------------------------------------------------------------------

/**
 * Thrown by {@link computeDowngradeExcess} when the requested `targetPlanSlug`
 * is not registered in the static billing catalog.
 *
 * Callers (e.g. the `apply-scheduled-plan-changes` cron) can distinguish this
 * from genuine runtime errors via `instanceof PlanCatalogMissError` and apply
 * soft-skip semantics — a missing catalog entry means no caps are available to
 * evaluate, not a data-integrity failure.
 */
export class PlanCatalogMissError extends Error {
    /** The slug that was not found. */
    readonly planSlug: string;

    constructor(planSlug: string) {
        super(`Target plan '${planSlug}' not found in the billing catalog`);
        this.name = 'PlanCatalogMissError';
        this.planSlug = planSlug;
    }
}

// ---------------------------------------------------------------------------
// Minimal shape contracts for injected data sources
// ---------------------------------------------------------------------------

/**
 * Minimal accommodation shape required by the excess helper.
 * Callers map their DB rows to this shape before passing to `getActiveAccommodationsForOwner`.
 */
export interface AccommodationForExcess {
    readonly id: string;
    readonly name: string;
    readonly updatedAt: Date;
    readonly planRestricted: boolean;
    readonly description: string;
    /** `viewCount` is used as a secondary sort tiebreaker when non-null. */
    readonly viewCount?: number | null;
    readonly media?: {
        readonly featuredImage?: { readonly url: string } | null;
        readonly gallery?: ReadonlyArray<{ readonly url: string }>;
    } | null;
}

/**
 * Minimal promotion shape required by the excess helper.
 */
export interface PromotionForExcess {
    readonly id: string;
    /** The promotion display name (mapped from `title` in the DB schema). */
    readonly title: string;
    readonly updatedAt: Date;
    readonly planRestricted: boolean;
    /** `viewCount` is used as a secondary sort tiebreaker when non-null. */
    readonly viewCount?: number | null;
}

// ---------------------------------------------------------------------------
// Dependency injection contract
// ---------------------------------------------------------------------------

/**
 * External dependencies for `computeDowngradeExcess`.
 *
 * Injecting these as a record (RO-RO) makes the function fully unit-testable
 * without mocking module-level singletons.
 */
export interface ComputeDowngradeExcessDeps {
    /**
     * Fetches all non-deleted, active, non-plan-restricted accommodations owned
     * by the given user.
     *
     * IMPORTANT: the implementation SHOULD return ALL accommodations (including
     * `planRestricted: true` ones) so the service can compute idempotency-safe
     * counts. The service itself filters out `planRestricted: true` items.
     * Alternatively, implementations may pre-filter — both approaches yield
     * the same result as long as the caller contract is documented.
     *
     * For production wiring: query the `accommodations` table with
     * `ownerId = userId AND deletedAt IS NULL AND lifecycleState = 'ACTIVE'`.
     */
    getActiveAccommodationsForOwner(userId: string): Promise<AccommodationForExcess[]>;

    /**
     * Fetches all non-deleted, lifecycle-ACTIVE promotions owned by the host.
     *
     * Same idempotency note as `getActiveAccommodationsForOwner`: the service
     * filters `planRestricted: true` from the result.
     */
    getActivePromotionsForOwner(userId: string): Promise<PromotionForExcess[]>;

    /**
     * Resolves a plan definition by slug.
     * Wraps `getPlanBySlug` from `@repo/billing` (pure in-memory).
     * Returns `undefined` when the slug is not found.
     */
    getPlanBySlug(slug: string): PlanDefinition | undefined;
}

// ---------------------------------------------------------------------------
// Default production dependencies
// ---------------------------------------------------------------------------

/**
 * Production-ready dependency implementations.
 *
 * These are exported so the route handler / cron job can call the helper
 * without boilerplate:
 *
 * ```ts
 * import { computeDowngradeExcess, defaultExcessDeps } from './subscription-downgrade-excess.service';
 * const preview = await computeDowngradeExcess(input, defaultExcessDeps);
 * ```
 */
export const defaultExcessDeps: ComputeDowngradeExcessDeps = {
    async getActiveAccommodationsForOwner(userId: string): Promise<AccommodationForExcess[]> {
        const { accommodationModel } = await import('@repo/db');
        // Query accommodations for the owner: lifecycle=ACTIVE, not deleted.
        // planRestricted items are intentionally included — the service filters them.
        // Using findAll with a large pageSize to get all records (hosts rarely exceed 50).
        const rows = await accommodationModel.findAll(
            { ownerId: userId, lifecycleState: 'ACTIVE', deletedAt: null },
            { pageSize: 1000 }
        );
        return (rows.items ?? []).map((a) => ({
            id: a.id,
            name: a.name,
            updatedAt: a.updatedAt,
            planRestricted: a.planRestricted ?? false,
            description: a.description ?? '',
            viewCount: null, // view data not trivially reachable — see spec §3 tiebreaker note
            media: (a.media as AccommodationForExcess['media']) ?? null
        }));
    },

    async getActivePromotionsForOwner(userId: string): Promise<PromotionForExcess[]> {
        const { ownerPromotionModel } = await import('@repo/db');
        // findByOwnerId returns all (including planRestricted); filter applied by service.
        const rows = await ownerPromotionModel.findByOwnerId(userId);
        return (rows.items ?? [])
            .filter((p) => p.lifecycleState === 'ACTIVE')
            .map((p) => ({
                id: p.id,
                title: p.title,
                updatedAt: p.updatedAt,
                planRestricted: p.planRestricted ?? false,
                viewCount: null
            }));
    },

    getPlanBySlug(slug: string): PlanDefinition | undefined {
        return billingGetPlanBySlug(slug);
    }
};

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

/**
 * Compare function for excess items: most-recently-updated first.
 * Tiebreaker: higher viewCount first (descending). Null viewCount is treated
 * as 0 — documented in spec §3 ("most-viewed as tiebreaker ONLY if view data
 * is trivially reachable — if not, document and use updatedAt alone").
 */
function compareByRecency(
    a: { updatedAt: Date; viewCount?: number | null },
    b: { updatedAt: Date; viewCount?: number | null }
): number {
    const timeDiff = b.updatedAt.getTime() - a.updatedAt.getTime();
    if (timeDiff !== 0) return timeDiff;
    // Tiebreaker: more views → kept (descending)
    const aViews = a.viewCount ?? 0;
    const bViews = b.viewCount ?? 0;
    return bViews - aViews;
}

// ---------------------------------------------------------------------------
// Core helper: buildExcessItems
// ---------------------------------------------------------------------------

/**
 * Given a list of items (accommodations or promotions sorted by recency) and a
 * target cap, build the {@link DowngradeExcessItem} array with `keepByDefault`
 * flags applied.
 *
 * @param sorted - Items already sorted by `compareByRecency`.
 * @param cap - Target plan limit (must be >= 0; caller ensures -1 is handled upstream).
 */
function buildExcessItems(
    sorted: ReadonlyArray<{
        id: string;
        name: string;
        updatedAt: Date;
        viewCount?: number | null;
    }>,
    cap: number
): DowngradeExcessItem[] {
    return sorted.map(
        (item, index): DowngradeExcessItem => ({
            id: item.id,
            name: item.name,
            updatedAt: item.updatedAt.toISOString(),
            viewCount: item.viewCount ?? null,
            keepByDefault: index < cap
        })
    );
}

// ---------------------------------------------------------------------------
// Main exported helper
// ---------------------------------------------------------------------------

/**
 * Compute the per-dimension excess preview for a host downgrading to a target plan.
 *
 * **Read-only.** No database mutations are performed.
 *
 * @param input - Identifies the host (`userId`) and target plan (`targetPlanSlug`).
 * @param deps - External data dependencies (injectable for tests; defaults to
 *   {@link defaultExcessDeps} for production).
 * @returns A {@link DowngradePreview} describing excess per dimension.
 * @throws {Error} When `targetPlanSlug` is not found in the billing catalog.
 *
 * @example
 * ```ts
 * const preview = await computeDowngradeExcess(
 *   { userId: 'user-123', targetPlanSlug: 'owner-basico' },
 *   defaultExcessDeps
 * );
 * if (preview.hasExcess) {
 *   // Surface the preview to the host before scheduling the downgrade.
 * }
 * ```
 */
export async function computeDowngradeExcess(
    input: ComputeDowngradeExcessInput,
    deps: ComputeDowngradeExcessDeps = defaultExcessDeps
): Promise<DowngradePreview> {
    const { userId, targetPlanSlug } = input;

    // ── 1. Resolve target plan ─────────────────────────────────────────────
    const targetPlan = deps.getPlanBySlug(targetPlanSlug);
    if (!targetPlan) {
        throw new PlanCatalogMissError(targetPlanSlug);
    }

    const targetEntitlementSet = new Set(targetPlan.entitlements);
    const targetLimitMap = new Map(targetPlan.limits.map((l) => [l.key, l.value]));

    const maxAccommodations = targetLimitMap.get(LimitKey.MAX_ACCOMMODATIONS) ?? -1;
    const maxActivePromotions = targetLimitMap.get(LimitKey.MAX_ACTIVE_PROMOTIONS) ?? -1;
    const maxPhotosPerAccommodation =
        targetLimitMap.get(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION) ?? -1;

    const targetHasRichDescription = targetEntitlementSet.has(
        EntitlementKey.CAN_USE_RICH_DESCRIPTION
    );
    const targetHasVideoEmbed = targetEntitlementSet.has(EntitlementKey.CAN_EMBED_VIDEO);

    // ── 2. Fetch active resources ──────────────────────────────────────────
    const [rawAccommodations, rawPromotions] = await Promise.all([
        deps.getActiveAccommodationsForOwner(userId),
        deps.getActivePromotionsForOwner(userId)
    ]);

    // ── 3. Filter out already-restricted items (idempotency) ───────────────
    const accommodations = rawAccommodations.filter((a) => !a.planRestricted);
    const promotions = rawPromotions.filter((p) => !p.planRestricted);

    // ── 4. Accommodation quantity excess ──────────────────────────────────
    const sortedAccommodations = [...accommodations].sort(compareByRecency);

    const accExcess = (function buildAccommodationExcess() {
        if (maxAccommodations === -1) {
            // Unlimited — no excess possible
            return {
                cap: -1,
                activeCount: accommodations.length,
                excessCount: 0,
                items: [] as DowngradeExcessItem[]
            };
        }

        const activeCount = accommodations.length;
        const excessCount = Math.max(0, activeCount - maxAccommodations);

        if (excessCount === 0) {
            return {
                cap: maxAccommodations,
                activeCount,
                excessCount: 0,
                items: [] as DowngradeExcessItem[]
            };
        }

        const items = buildExcessItems(
            sortedAccommodations.map((a) => ({
                id: a.id,
                name: a.name,
                updatedAt: a.updatedAt,
                viewCount: a.viewCount
            })),
            maxAccommodations
        );

        return { cap: maxAccommodations, activeCount, excessCount, items };
    })();

    // ── 5. Promotion quantity excess ──────────────────────────────────────
    const sortedPromotions = [...promotions].sort(compareByRecency);

    const promoExcess = (function buildPromotionExcess() {
        if (maxActivePromotions === -1) {
            return {
                cap: -1,
                activeCount: promotions.length,
                excessCount: 0,
                items: [] as DowngradeExcessItem[]
            };
        }

        const activeCount = promotions.length;
        const excessCount = Math.max(0, activeCount - maxActivePromotions);

        if (excessCount === 0) {
            return {
                cap: maxActivePromotions,
                activeCount,
                excessCount: 0,
                items: [] as DowngradeExcessItem[]
            };
        }

        const items = buildExcessItems(
            sortedPromotions.map((p) => ({
                id: p.id,
                name: p.title,
                updatedAt: p.updatedAt,
                viewCount: p.viewCount
            })),
            maxActivePromotions
        );

        return { cap: maxActivePromotions, activeCount, excessCount, items };
    })();

    // ── 6. Per-accommodation photo excess ─────────────────────────────────
    const photoExcessEntries: DowngradePreview['photos'] = [];

    if (maxPhotosPerAccommodation !== -1) {
        for (const acc of accommodations) {
            const gallery = acc.media?.gallery ?? [];
            const hasFeaturedImage = Boolean(acc.media?.featuredImage?.url);
            // Total = gallery + featured
            const totalCount = gallery.length + (hasFeaturedImage ? 1 : 0);

            if (totalCount <= maxPhotosPerAccommodation) {
                continue; // at or under cap
            }

            // How many gallery slots are available (featuredImage occupies one slot)?
            const gallerySlots = Math.max(
                0,
                maxPhotosPerAccommodation - (hasFeaturedImage ? 1 : 0)
            );
            // Overflow = gallery items beyond gallerySlots, taken from the end of the array
            const overflowGallery = gallery.slice(gallerySlots);
            const excessCount = overflowGallery.length;

            if (excessCount === 0) continue;

            photoExcessEntries.push({
                accommodationId: acc.id,
                accommodationName: acc.name,
                cap: maxPhotosPerAccommodation,
                totalCount,
                excessCount,
                hasFeaturedImage,
                overflowPhotoUrls: overflowGallery.map((img) => img.url)
            });
        }
    }

    // ── 7. Grandfather content flags ──────────────────────────────────────
    const grandfatherFlagEntries: DowngradePreview['grandfatherFlags'] = [];

    for (const acc of accommodations) {
        const richDetected =
            !targetHasRichDescription && containsRichDescription(acc.description ?? '');
        const videoDetected = !targetHasVideoEmbed && containsVideoEmbed(acc.description ?? '');

        if (!richDetected && !videoDetected) continue;

        grandfatherFlagEntries.push({
            accommodationId: acc.id,
            accommodationName: acc.name,
            hasRichDescription: richDetected,
            hasVideoEmbed: videoDetected
        });
    }

    // ── 8. Assemble result ────────────────────────────────────────────────
    const hasExcess =
        accExcess.excessCount > 0 || promoExcess.excessCount > 0 || photoExcessEntries.length > 0;

    return {
        accommodations: accExcess,
        promotions: promoExcess,
        photos: photoExcessEntries,
        grandfatherFlags: grandfatherFlagEntries,
        hasExcess
    };
}
