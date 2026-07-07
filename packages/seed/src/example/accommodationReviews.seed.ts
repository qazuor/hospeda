import { AccommodationReviewModel } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { AccommodationReviewService, computeAccommodationReviewAverage } from '@repo/service-core';
import exampleManifest from '../manifest-example.json';
import { deterministicFixtureId } from '../utils/deterministicFixtureId.js';
import { STATUS_ICONS } from '../utils/icons.js';
import type { SeedContext } from '../utils/seedContext.js';
import { createSeedFactory } from '../utils/seedFactory.js';

/**
 * Derives the deterministic UUIDv5 id for an `example` accommodation review
 * fixture (HOS-25 T-025), from the fixture's own top-level `id` seed-key.
 *
 * Exported (rather than an inline lambda) so tests can assert the id is
 * stable across calls without running the full seed pipeline, mirroring
 * `getAccommodationFixtureId` in `accommodations.seed.ts` (HOS-25 T-016).
 *
 * @param item - Raw accommodation review fixture item (pre-normalization)
 * @returns Stable UUIDv5 derived from the fixture's seed-key
 */
export const getAccommodationReviewFixtureId = (item: unknown): string =>
    deterministicFixtureId({
        seedKey: `accommodationReview:${(item as { id: string }).id}`
    });

/**
 * Normalizer for accommodation review data.
 *
 * Also computes and sets `averageRating` (see HOS-25 T-025): every `example`
 * review is now created via the deterministic-id, model-direct path (see
 * `deterministicId` below), which bypasses `AccommodationReviewService
 * ._afterCreate` — the hook that would otherwise compute this same
 * per-review average from the JSONB `rating` dimensions. Reuses the exact
 * same pure computation (`computeAccommodationReviewAverage`, exported from
 * `@repo/service-core`) instead of re-implementing it, with the same
 * rounding the service itself applies at the call site.
 *
 * `moderationState` is intentionally left unset here: the DB column default
 * (`APPROVED`) is what curated seed content should have anyway (see
 * "Seed Moderation Conventions" in `packages/seed/CLAUDE.md`), so skipping
 * the bypassed content-moderation scoring hook is safe.
 */
const accommodationReviewNormalizer = (data: Record<string, unknown>) => {
    // First exclude metadata fields and auto-generated fields
    const { $schema, id, ...cleanData } = data as {
        $schema?: string;
        id?: string;
        [key: string]: unknown;
    };

    const averageRating =
        Math.round(computeAccommodationReviewAverage(cleanData.rating) * 100) / 100;
    return { ...cleanData, averageRating };
};

/**
 * Pre-process callback to map IDs and set correct actor
 */
const preProcessReview = async (item: unknown, context: SeedContext) => {
    const reviewData = item as Record<string, unknown>;

    // Map seed IDs to real database IDs using specific getters
    const seedUserId = reviewData.userId as string;
    const seedAccommodationId = reviewData.accommodationId as string;

    if (seedUserId) {
        const realUserId = context.idMapper.getMappedUserId(seedUserId);
        if (!realUserId) {
            throw new Error(`No mapping found for user ID: ${seedUserId}`);
        }
        reviewData.userId = realUserId;
    }

    if (seedAccommodationId) {
        const realAccommodationId = context.idMapper.getMappedAccommodationId(seedAccommodationId);
        if (!realAccommodationId) {
            throw new Error(`No mapping found for accommodation ID: ${seedAccommodationId}`);
        }
        reviewData.accommodationId = realAccommodationId;
    }

    if (seedUserId) {
        // Set the actor to be the owner of the accommodation
        const realUserId = context.idMapper.getMappedUserId(seedUserId);
        if (realUserId) {
            // We need to get the user data to create the actor
            // For now, we'll use a basic actor structure
            // TODO: Get full user data from database if needed
            context.actor = {
                id: realUserId,
                role: RoleEnum.SUPER_ADMIN, // Default role, should be updated with actual user role
                permissions: [PermissionEnum.ACCOMMODATION_REVIEW_CREATE] as PermissionEnum[] // Default permissions, should be updated with actual user permissions
            };
        }
    }
};

/**
 * Get entity info for accommodation review
 */
const getAccommodationReviewInfo = (item: unknown, context: SeedContext) => {
    const reviewData = item as Record<string, unknown>;
    const title = reviewData.title as string;
    const rating = reviewData.rating as Record<string, number> | number;
    const accommodationId = reviewData.accommodationId as string;

    // Calculate average rating
    let averageRating: number;
    if (typeof rating === 'object' && rating !== null) {
        const ratingValues = Object.values(rating);
        averageRating = ratingValues.reduce((sum, val) => sum + val, 0) / ratingValues.length;
    } else if (typeof rating === 'number') {
        averageRating = rating;
    } else {
        averageRating = 0;
    }

    // Round to 1 decimal place
    const roundedRating = Math.round(averageRating * 10) / 10;

    const accommodationName = context.idMapper.getDisplayNameByRealId(
        'accommodations',
        accommodationId
    );
    return `"${title}" (${STATUS_ICONS.Highlight} ${roundedRating}) → Dest: ${accommodationName}`;
};

/**
 * Recalculates the parent accommodation's aggregate stats (`reviewsCount`,
 * `averageRating`, `rating`) after a model-direct review insert (HOS-25 T-025).
 *
 * Runs after EVERY review row rather than only once per accommodation: since
 * `AccommodationReviewService.recalculateStats` re-aggregates from ALL
 * currently-persisted reviews for that accommodation on every call, this is
 * idempotent — the extra calls for accommodations with more than one review
 * fixture are redundant but harmless, and the accommodation's stats are
 * always correct once the last review for it has been processed. With ~36
 * `example` review fixtures total, the redundant work is negligible; tracking
 * "already recalculated this accommodation" would require an end-of-batch
 * hook `SeedFactoryConfig` does not expose, and would risk missing later
 * reviews for the same accommodation if done naively (e.g. only on first
 * encounter).
 */
const postProcessReview = async (result: unknown) => {
    const accommodationId = (result as { data?: { accommodationId?: string } })?.data
        ?.accommodationId;
    if (!accommodationId) return;

    const service = new AccommodationReviewService({});
    await service.recalculateStats(accommodationId);
};

/**
 * AccommodationReviews seed using Seed Factory
 */
export const seedAccommodationReviews = createSeedFactory({
    entityName: 'AccommodationReviews',
    serviceClass: AccommodationReviewService,
    folder: 'src/data/accommodationReview',
    files: exampleManifest.accommodationReviews,
    normalizer: accommodationReviewNormalizer,
    getEntityInfo: getAccommodationReviewInfo,
    preProcess: preProcessReview,
    postProcess: postProcessReview,

    // HOS-25 T-025: every `example` accommodation review gets a stable UUIDv5
    // derived from its fixture seed-key, so versioned data-migrations can
    // target a specific review by a fixed id. See the audit note on
    // `accommodationReviewNormalizer` above for why this bypasses
    // `AccommodationReviewService._afterCreate` safely (the per-review
    // average is computed inline, and the parent accommodation's aggregate
    // stats are recomputed via `postProcessReview` above).
    deterministicId: {
        modelClass: AccommodationReviewModel,
        getId: getAccommodationReviewFixtureId
    }
});
