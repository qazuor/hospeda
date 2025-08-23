import path from 'node:path';
import { PostService, RoleEnum } from '@repo/service-core';
import { PermissionEnum } from '@repo/types';
import exampleManifest from '../manifest-example.json';
import type { SeedContext } from '../utils/seedContext.js';
import { createSeedFactory } from '../utils/seedFactory.js';
import { getRandomFutureDate } from '../utils/utils.js';

/**
 * Normalizer for post data
 */
const postNormalizer = (data: Record<string, unknown>) => {
    // First exclude metadata fields and auto-generated fields
    const { $schema, id, slug, tagIds, likes, comments, expiresAt, shares, ...cleanData } =
        data as {
            $schema?: string;
            id?: string;
            slug?: string;
            tagIds?: string[];
            likes?: number;
            comments?: number;
            shares?: number;
            expiresAt?: string;
            [key: string]: unknown;
        };
    if (data.expiresAt && typeof data.expiresAt === 'string') {
        cleanData.expiresAt = getRandomFutureDate();
    }
    return cleanData;
};

/**
 * Pre-process callback to map IDs and set correct actor
 */
const preProcessPost = async (item: unknown, context: SeedContext) => {
    const postData = item as Record<string, unknown>;

    // Map seed IDs to real database IDs using specific getters
    const seedAuthorId = postData.authorId as string;
    const seedRelatedDestinationId = postData.relatedDestinationId as string;
    const seedRelatedAccommodationId = postData.relatedAccommodationId as string;
    const seedRelatedEventId = postData.relatedEventId as string;

    if (seedAuthorId) {
        const realPostId = context.idMapper.getMappedUserId(seedAuthorId);
        if (!realPostId) {
            throw new Error(`No mapping found for Author ID: ${seedAuthorId}`);
        }
        postData.authorId = realPostId;
    }

    if (seedRelatedDestinationId) {
        const realRelatedDestinationId =
            context.idMapper.getMappedDestinationId(seedRelatedDestinationId);
        if (!realRelatedDestinationId) {
            throw new Error(
                `No mapping found for Related Destination ID: ${seedRelatedDestinationId}`
            );
        }
        postData.relatedDestinationId = realRelatedDestinationId;
    } else {
        // biome-ignore lint/performance/noDelete: <explanation>
        delete postData.relatedDestinationId;
    }

    if (seedRelatedAccommodationId) {
        const realRelatedAccommodationId = context.idMapper.getMappedAccommodationId(
            seedRelatedAccommodationId
        );
        if (!realRelatedAccommodationId) {
            throw new Error(
                `No mapping found for Related Accommodation ID: ${seedRelatedAccommodationId}`
            );
        }
        postData.relatedAccommodationId = realRelatedAccommodationId;
    } else {
        // biome-ignore lint/performance/noDelete: <explanation>
        delete postData.relatedAccommodationId;
    }

    if (seedRelatedEventId) {
        const realRelatedEventId = context.idMapper.getMappedEventId(seedRelatedEventId);
        if (!realRelatedEventId) {
            throw new Error(`No mapping found for Related Event ID: ${seedRelatedEventId}`);
        }
        postData.relatedEventId = realRelatedEventId;
    } else {
        // biome-ignore lint/performance/noDelete: <explanation>
        delete postData.relatedEventId;
    }

    if (seedAuthorId) {
        // Set the actor to be the owner of the accommodation
        const realAuthorId = context.idMapper.getMappedUserId(seedAuthorId);
        if (realAuthorId) {
            // We need to get the user data to create the actor
            // For now, we'll use a basic actor structure
            // TODO [91fcf178-3e18-4f0a-a508-cac3a83e75a4]: Get full user data from database if needed
            context.actor = {
                id: realAuthorId,
                role: RoleEnum.SUPER_ADMIN, // Default role, should be updated with actual user role
                permissions: [
                    PermissionEnum.POST_CREATE,
                    PermissionEnum.POST_UPDATE
                ] as PermissionEnum[] // Default permissions, should be updated with actual user permissions
            };
        }
    }
};

/**
 * Get entity info for post
 */
const getPostInfo = (item: unknown) => {
    const postData = item as Record<string, unknown>;
    const title = postData.title as string;
    const category = postData.category as string;
    return `"${title}" (${category})`;
};

/**
 * Posts seed using Seed Factory
 */
export const seedPosts = createSeedFactory({
    entityName: 'Posts',
    serviceClass: PostService,
    folder: path.resolve('src/data/post'),
    files: exampleManifest.posts,
    normalizer: postNormalizer,
    getEntityInfo: getPostInfo,
    preProcess: preProcessPost
});
