import path from 'node:path';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { DestinationReviewService } from '@repo/service-core';
import exampleManifest from '../manifest-example.json';
import { STATUS_ICONS } from '../utils/icons.js';
import type { SeedContext } from '../utils/seedContext.js';
import { createSeedFactory } from '../utils/seedFactory.js';

/**
 * Normalizer for destination review data
 */
const destinationReviewNormalizer = (data: Record<string, unknown>) => {
    // First exclude metadata fields and auto-generated fields
    const { $schema, id, ...cleanData } = data as {
        $schema?: string;
        id?: string;
        [key: string]: unknown;
    };
    return cleanData;
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
            // TODO [63f773d1-b819-46d9-91cd-cf5eabfdaded]: Get full user data from database if needed
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
 * DestinationReviews seed using Seed Factory
 */
export const seedDestinationReviews = createSeedFactory({
    entityName: 'DestinationReviews',
    serviceClass: DestinationReviewService,
    folder: path.resolve('src/data/destinationReview'),
    files: exampleManifest.destinationReviews,
    normalizer: destinationReviewNormalizer,
    getEntityInfo: getDestinationReviewInfo,
    preProcess: preProcessReview
});
