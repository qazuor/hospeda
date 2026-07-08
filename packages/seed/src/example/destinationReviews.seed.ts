import { DestinationReviewModel } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { computeReviewAverageRating, DestinationReviewService } from '@repo/service-core';
import exampleManifest from '../manifest-example.json';
import { deterministicFixtureId } from '../utils/deterministicFixtureId.js';
import { STATUS_ICONS } from '../utils/icons.js';
import type { SeedContext } from '../utils/seedContext.js';
import { createSeedFactory } from '../utils/seedFactory.js';

/**
 * Derives the deterministic UUIDv5 id for an `example` destination review
 * fixture (HOS-25 T-025), from the fixture's own top-level `id` seed-key.
 *
 * Exported (rather than an inline lambda) so tests can assert the id is
 * stable across calls without running the full seed pipeline, mirroring
 * `getAccommodationReviewFixtureId` in `accommodationReviews.seed.ts`.
 *
 * @param item - Raw destination review fixture item (pre-normalization)
 * @returns Stable UUIDv5 derived from the fixture's seed-key
 */
export const getDestinationReviewFixtureId = (item: unknown): string =>
    deterministicFixtureId({
        seedKey: `destinationReview:${(item as { id: string }).id}`
    });

/**
 * Normalizer for destination review data.
 *
 * Also computes and sets `averageRating` (see HOS-25 T-025): every `example`
 * review is now created via the deterministic-id, model-direct path (see
 * `deterministicId` below), which bypasses `DestinationReviewService
 * ._afterCreate` — the hook that would otherwise compute this same
 * per-review average from the JSONB `rating` dimensions. Reuses the exact
 * same pure computation (`computeReviewAverageRating`, exported from
 * `@repo/service-core`, which already rounds to 2 decimals) instead of
 * re-implementing it.
 *
 * `moderationState` is intentionally left unset here: the DB column default
 * (`APPROVED`) is what curated seed content should have anyway (see
 * "Seed Moderation Conventions" in `packages/seed/CLAUDE.md`), so skipping
 * the bypassed content-moderation scoring hook is safe.
 */
const destinationReviewNormalizer = (data: Record<string, unknown>) => {
    // First exclude metadata fields and auto-generated fields
    const { $schema, id, ...cleanData } = data as {
        $schema?: string;
        id?: string;
        [key: string]: unknown;
    };

    const averageRating = computeReviewAverageRating(cleanData.rating as Record<string, unknown>);
    return { ...cleanData, averageRating };
};

/**
 * Pre-process callback to map IDs and set correct actor
 */
const preProcessReview = async (item: unknown, context: SeedContext) => {
    const reviewData = item as Record<string, unknown>;

    // Map seed IDs to real database IDs using specific getters
    const seedUserId = reviewData.userId as string;
    const seedDestinationId = reviewData.destinationId as string;

    if (seedUserId) {
        const realUserId = context.idMapper.getMappedUserId(seedUserId);
        if (!realUserId) {
            throw new Error(`No mapping found for user ID: ${seedUserId}`);
        }
        reviewData.userId = realUserId;
    }

    if (seedDestinationId) {
        const realDestinationId = context.idMapper.getMappedDestinationId(seedDestinationId);
        if (!realDestinationId) {
            throw new Error(`No mapping found for destination ID: ${seedDestinationId}`);
        }
        reviewData.destinationId = realDestinationId;
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
                permissions: [PermissionEnum.DESTINATION_REVIEW_CREATE] as PermissionEnum[] // Default permissions, should be updated with actual user permissions
            };
        }
    }
};

/**
 * Get entity info for destination review
 */
const getDestinationReviewInfo = (item: unknown, context: SeedContext) => {
    const reviewData = item as Record<string, unknown>;
    const title = reviewData.title as string;
    const rating = reviewData.rating as Record<string, number> | number;
    const destinationId = reviewData.destinationId as string;

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

    const destinationName = context.idMapper.getDisplayNameByRealId('destinations', destinationId);
    return `"${title}" (${STATUS_ICONS.Highlight} ${roundedRating}) → Dest: ${destinationName}`;
};

/**
 * Recalculates the parent destination's aggregate stats (`reviewsCount`,
 * `averageRating`, `rating`) after a model-direct review insert (HOS-25 T-025).
 *
 * Runs after EVERY review row — see the identical trade-off note on
 * `postProcessReview` in `accommodationReviews.seed.ts` for why this is
 * correct (idempotent re-aggregation) despite being called more often than
 * strictly necessary.
 */
const postProcessReview = async (result: unknown) => {
    const destinationId = (result as { data?: { destinationId?: string } })?.data?.destinationId;
    if (!destinationId) return;

    const service = new DestinationReviewService({});
    await service.recalculateStats(destinationId);
};

/**
 * DestinationReviews seed using Seed Factory
 */
export const seedDestinationReviews = createSeedFactory({
    entityName: 'DestinationReviews',
    serviceClass: DestinationReviewService,
    folder: 'src/data/destinationReview',
    files: exampleManifest.destinationReviews,
    normalizer: destinationReviewNormalizer,
    getEntityInfo: getDestinationReviewInfo,
    preProcess: preProcessReview,
    postProcess: postProcessReview,

    // HOS-25 T-025: every `example` destination review gets a stable UUIDv5
    // derived from its fixture seed-key, so versioned data-migrations can
    // target a specific review by a fixed id. See the audit note on
    // `destinationReviewNormalizer` above for why this bypasses
    // `DestinationReviewService._afterCreate` safely (the per-review average
    // is computed inline, and the parent destination's aggregate stats are
    // recomputed via `postProcessReview` above).
    deterministicId: {
        modelClass: DestinationReviewModel,
        getId: getDestinationReviewFixtureId
    }
});
