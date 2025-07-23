import path from 'node:path';
import { DestinationReviewService, RoleEnum } from '@repo/service-core';
import { PermissionEnum } from '@repo/types';
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
const getDestinationReviewInfo = (item: unknown) => {
    const reviewData = item as Record<string, unknown>;
    const title = reviewData.title as string;
    const rating = reviewData.rating as number;
    const destinationId = reviewData.destinationId as string;
    return `"${title}" (${STATUS_ICONS.Highlight}${rating}/5) → Dest: ${destinationId}`;
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
