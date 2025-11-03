import path from 'node:path';
import { EntityTypeEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import { UserBookmarkService } from '@repo/service-core';
import exampleManifest from '../manifest-example.json';
import type { SeedContext } from '../utils/seedContext.js';
import { createSeedFactory } from '../utils/seedFactory.js';

/**
 * Normalizer for bookmark data
 */
const bookmarkNormalizer = (data: Record<string, unknown>) => {
    // First exclude metadata fields and auto-generated fields
    const { $schema, id, ...cleanData } = data as {
        $schema?: string;
        id?: string;
        [key: string]: unknown;
    };
    // HACK: to dont modify all jsons
    // biome-ignore lint/performance/noDelete: <explanation>
    delete cleanData.lifecycleState;
    return cleanData;
};

/**
 * Pre-process callback to map IDs and set correct actor
 */
const preProcessBookmark = async (item: unknown, context: SeedContext) => {
    const bookmarkData = item as Record<string, unknown>;

    // Map seed IDs to real database IDs using specific getters
    const seedUserId = bookmarkData.userId as string;
    const seedEntityId = bookmarkData.entityId as string;
    const seedEntityType = bookmarkData.entityType as EntityTypeEnum;

    if (seedUserId) {
        const realUserId = context.idMapper.getMappedUserId(seedUserId);
        if (!realUserId) {
            throw new Error(`No mapping found for user ID: ${seedUserId}`);
        }
        bookmarkData.userId = realUserId;
    }

    let realEntityId: string | undefined;

    switch (seedEntityType) {
        case EntityTypeEnum.DESTINATION:
            realEntityId = context.idMapper.getMappedDestinationId(seedEntityId);
            break;
        case EntityTypeEnum.ACCOMMODATION:
            realEntityId = context.idMapper.getMappedAccommodationId(seedEntityId);
            break;
        case EntityTypeEnum.EVENT:
            realEntityId = context.idMapper.getMappedEventId(seedEntityId);
            break;
        case EntityTypeEnum.POST:
            realEntityId = context.idMapper.getMappedPostId(seedEntityId);
            break;
        case EntityTypeEnum.USER:
            realEntityId = context.idMapper.getMappedUserId(seedEntityId);
            break;
        default:
            throw new Error(`Invalid entity type: ${seedEntityType}`);
    }

    if (!realEntityId) {
        throw new Error(`No mapping found for ${seedEntityType} ID: ${seedEntityId}`);
    }
    bookmarkData.entityId = realEntityId;

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
                permissions: [PermissionEnum.USER_BOOKMARK_MANAGE] as PermissionEnum[] // Default permissions, should be updated with actual user permissions
            };
        }
    }
};

/**
 * Get entity info for bookmark
 */
const getBookmarkInfo = (item: unknown, context: SeedContext) => {
    const bookmarkData = item as Record<string, unknown>;
    const userId = bookmarkData.userId as string;
    const entityType = bookmarkData.entityType as string;
    const entityId = bookmarkData.entityId as string;
    const entityTypeMap = {
        DESTINATION: 'destinations',
        ACCOMMODATION: 'accommodations',
        EVENT: 'events',
        POST: 'posts',
        USER: 'users'
    } as const;

    const userIdName = context.idMapper.getDisplayNameByRealId('users', userId);
    const entityTypeKey = entityTypeMap[entityType as keyof typeof entityTypeMap];
    const entityName = context.idMapper.getDisplayNameByRealId(
        entityTypeKey || 'unknown',
        entityId
    );
    return `User: ${userIdName} → ${entityType}: ${entityName}`;
};

/**
 * Bookmarks seed using Seed Factory
 */
export const seedBookmarks = createSeedFactory({
    entityName: 'Bookmarks',
    serviceClass: UserBookmarkService,
    folder: path.resolve('src/data/bookmark'),
    files: exampleManifest.bookmarks,
    normalizer: bookmarkNormalizer,
    getEntityInfo: getBookmarkInfo,
    preProcess: preProcessBookmark
});
