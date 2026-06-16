import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { UserBookmarkCollectionService } from '@repo/service-core';
import exampleManifest from '../manifest-example.json';
import type { SeedContext } from '../utils/seedContext.js';
import { createSeedFactory } from '../utils/seedFactory.js';

const MANIFEST_FILES: string[] =
    ((exampleManifest as Record<string, unknown>).userBookmarkCollections as string[]) ?? [];

/**
 * Normalizer for user bookmark collection data.
 *
 * Strips JSON-schema metadata (`$schema`, `id`) and removes the
 * `lifecycleState` field that is present in fixture files but is not
 * accepted by the service layer at creation time.
 *
 * @param data - Raw JSON data loaded from the fixture file
 * @returns Cleaned data ready for service creation
 */
const collectionNormalizer = (data: Record<string, unknown>) => {
    // Exclude metadata fields and auto-generated fields
    const { $schema, id, ...cleanData } = data as {
        $schema?: string;
        id?: string;
        [key: string]: unknown;
    };
    // HACK: to dont modify all jsons
    // biome-ignore lint/performance/noDelete: removing optional property from seed data object to avoid DB insertion errors
    delete cleanData.lifecycleState;
    return cleanData;
};

/**
 * Pre-process callback to map seed IDs to real database IDs and configure
 * the actor used for the creation call.
 *
 * Resolves `userId` from the fixture's seed-time string ID to the real UUID
 * that was persisted when the users seed ran.  Sets `context.actor` to a
 * SUPER_ADMIN actor with the `USER_BOOKMARK_COLLECTION_CREATE` permission so
 * the service layer authorises the operation.
 *
 * @param item    - Raw fixture item (typed as `unknown` by the factory)
 * @param context - Active seed context, including the ID mapper and actor slot
 *
 * @throws {Error} When no user mapping exists for the seed user ID
 */
const preProcessCollection = async (item: unknown, context: SeedContext): Promise<void> => {
    const collectionData = item as Record<string, unknown>;

    const seedUserId = collectionData.userId as string;

    if (seedUserId) {
        const realUserId = context.idMapper.getMappedUserId(seedUserId);
        if (!realUserId) {
            throw new Error(`No mapping found for user ID: ${seedUserId}`);
        }
        collectionData.userId = realUserId;

        // Set the actor to be the owner of the collection with the required creation permission.
        context.actor = {
            id: realUserId,
            role: RoleEnum.SUPER_ADMIN,
            permissions: [
                PermissionEnum.USER_BOOKMARK_COLLECTION_CREATE,
                PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW,
                PermissionEnum.USER_BOOKMARK_CREATE,
                PermissionEnum.USER_BOOKMARK_MANAGE
            ] as PermissionEnum[]
        };
    }
};

/**
 * Returns a human-readable description of a user bookmark collection item
 * for progress logging during the seed run.
 *
 * Format: `"User: {userName} → Collection: {collectionName}"`
 *
 * @param item    - The fixture item (typed as `unknown` by the factory)
 * @param context - Active seed context used to resolve display names
 * @returns Display string for log output
 */
const getCollectionInfo = (item: unknown, context: SeedContext): string => {
    const collectionData = item as Record<string, unknown>;
    const userId = collectionData.userId as string;
    const collectionName = collectionData.name as string;

    const userName = context.idMapper.getDisplayNameByRealId('users', userId);
    return `User: ${userName} → Collection: ${collectionName}`;
};

/**
 * Seed factory for the `user_bookmark_collections` table.
 *
 * Reads fixture files from `src/data/userBookmarkCollection/`, maps seed-time
 * user IDs to real database UUIDs, and calls
 * `UserBookmarkCollectionService.create()` for each record.
 *
 * After each successful insert the factory registers an ID mapping under the
 * `"userbookmarkcollections"` namespace so that subsequent bookmark seeds can
 * resolve `collectionId` references via
 * `context.idMapper.getRealId('userbookmarkcollections', seedId)`.
 *
 * @example
 * ```typescript
 * // Called automatically by the example seed runner (after T-S05).
 * await seedUserBookmarkCollections(context);
 * ```
 */
export const seedUserBookmarkCollections = createSeedFactory({
    entityName: 'UserBookmarkCollections',
    serviceClass: UserBookmarkCollectionService,
    folder: 'src/data/userBookmarkCollection',
    files: MANIFEST_FILES,
    normalizer: collectionNormalizer,
    getEntityInfo: getCollectionInfo,
    preProcess: preProcessCollection
});
