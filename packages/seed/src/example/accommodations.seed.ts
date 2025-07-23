import path from 'node:path';
import { AccommodationService } from '@repo/service-core/index.js';
import { RoleEnum } from '@repo/types';
import { PermissionEnum } from '@repo/types';
import exampleManifest from '../manifest-example.json';
import type { SeedContext } from '../utils/seedContext.js';
import { createSeedFactory } from '../utils/seedFactory.js';

/**
 * Normalizer for accommodation data
 */
const accommodationNormalizer = (data: Record<string, unknown>) => {
    // First exclude metadata fields and auto-generated fields
    const { $schema, id, slug, tagIds, averageRating, amenityIds, featureIds, ...cleanData } =
        data as {
            $schema?: string;
            id?: string;
            slug?: string;
            tagIds?: unknown[];
            averageRating?: number;
            [key: string]: unknown;
        };
    return cleanData;
};

/**
 * Pre-process callback to map IDs and set correct actor
 */
const preProcessAccommodation = async (item: unknown, context: SeedContext) => {
    const accommodationData = item as Record<string, unknown>;

    // Map seed IDs to real database IDs using specific getters
    const seedOwnerId = accommodationData.ownerId as string;
    const seedDestinationId = accommodationData.destinationId as string;

    if (seedOwnerId) {
        const realOwnerId = context.idMapper.getMappedUserId(seedOwnerId);
        if (!realOwnerId) {
            throw new Error(`No mapping found for owner ID: ${seedOwnerId}`);
        }
        accommodationData.ownerId = realOwnerId;
    }

    if (seedDestinationId) {
        const realDestinationId = context.idMapper.getMappedDestinationId(seedDestinationId);
        if (!realDestinationId) {
            throw new Error(`No mapping found for destination ID: ${seedDestinationId}`);
        }
        accommodationData.destinationId = realDestinationId;
    }

    // Set the actor to be the owner of the accommodation
    if (seedOwnerId) {
        const realOwnerId = context.idMapper.getMappedUserId(seedOwnerId);
        if (realOwnerId) {
            // We need to get the user data to create the actor
            // For now, we'll use a basic actor structure
            // TODO: Get full user data from database if needed
            context.actor = {
                id: realOwnerId,
                role: RoleEnum.SUPER_ADMIN, // Default role, should be updated with actual user role
                permissions: [
                    PermissionEnum.ACCOMMODATION_CREATE,
                    PermissionEnum.ACCOMMODATION_UPDATE_OWN,
                    PermissionEnum.ACCOMMODATION_UPDATE_ANY
                ] as PermissionEnum[] // Default permissions, should be updated with actual user permissions
            };
        }
    }
};

/**
 * Get entity info for accommodation
 */
const getAccommodationInfo = (item: unknown) => {
    const accommodationData = item as Record<string, unknown>;
    const name = accommodationData.name as string;
    const type = accommodationData.type as string;
    return `"${name}" (${type})`;
};

/**
 * Accommodations seed using Seed Factory
 */
export const seedAccommodations = createSeedFactory({
    entityName: 'Accommodations',
    serviceClass: AccommodationService,
    folder: path.resolve('src/data/accommodation'),
    files: exampleManifest.accommodations,
    normalizer: accommodationNormalizer,
    preProcess: preProcessAccommodation,
    getEntityInfo: getAccommodationInfo
});
