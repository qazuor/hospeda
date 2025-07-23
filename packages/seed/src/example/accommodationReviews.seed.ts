import path from 'node:path';
import { AccommodationReviewService, RoleEnum } from '@repo/service-core';
import { PermissionEnum } from '@repo/types';
import exampleManifest from '../manifest-example.json';
import { STATUS_ICONS } from '../utils/icons.js';
import type { SeedContext } from '../utils/seedContext.js';
import { createSeedFactory } from '../utils/seedFactory.js';

/**
 * Normalizer for accommodation review data
 */
const accommodationReviewNormalizer = (data: Record<string, unknown>) => {
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
const getAccommodationReviewInfo = (item: unknown) => {
    const reviewData = item as Record<string, unknown>;
    const title = reviewData.title as string;
    const rating = reviewData.rating as number;
    const accommodationId = reviewData.accommodationId as string;
    return `"${title}" (${STATUS_ICONS.Highlight}${rating}/5) → Acc: ${accommodationId}`;
};

/**
 * AccommodationReviews seed using Seed Factory
 */
export const seedAccommodationReviews = createSeedFactory({
    entityName: 'AccommodationReviews',
    serviceClass: AccommodationReviewService,
    folder: path.resolve('src/data/accommodationReview'),
    files: exampleManifest.accommodationReviews,
    normalizer: accommodationReviewNormalizer,
    getEntityInfo: getAccommodationReviewInfo,
    preProcess: preProcessReview
});
