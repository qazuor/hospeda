import { PostModel } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { PostService } from '@repo/service-core';
import exampleManifest from '../manifest-example.json';
import { deterministicFixtureId } from '../utils/deterministicFixtureId.js';
import type { SeedContext } from '../utils/seedContext.js';
import { createSeedFactory } from '../utils/seedFactory.js';
import { getRandomFutureDate } from '../utils/utils.js';

/**
 * Derives the deterministic UUIDv5 id for an `example` post fixture
 * (HOS-25 T-026), from the fixture's own top-level `id` seed-key.
 *
 * Exported (rather than an inline lambda) so tests can assert the id is
 * stable across calls without running the full seed pipeline, mirroring
 * `getAccommodationFixtureId` in `accommodations.seed.ts` (HOS-25 T-016).
 *
 * @param item - Raw post fixture item (pre-normalization)
 * @returns Stable UUIDv5 derived from the fixture's seed-key
 */
export const getPostFixtureId = (item: unknown): string =>
    deterministicFixtureId({
        seedKey: `post:${(item as { id: string }).id}`
    });

/**
 * Normalizer for post data.
 *
 * Keeps `slug` (see HOS-25 T-026): every `example` post is now created via
 * the deterministic-id, model-direct path (see `deterministicId` below),
 * which bypasses `PostService._beforeCreate` — the hook that would otherwise
 * auto-generate a unique slug via `generatePostSlug(category, title, isNews, date)`
 * (a DB-uniqueness-checking helper) when no slug is supplied. Fixture slugs are
 * already curated and verified unique across the whole `example` post dataset,
 * so passing them straight through is both safe and more readable than a
 * service-generated slug. `_beforeCreate` also validates title-uniqueness-per-category
 * and news-post `expiresAt` invariants and calls the (pure, defensive-only)
 * `normalizeCreateInput` trim/summary-fallback helper — all no-ops for this
 * already-curated, schema-valid fixture data, so skipping them is safe too.
 */
const postNormalizer = (data: Record<string, unknown>) => {
    // First exclude metadata fields and auto-generated fields
    const {
        $schema,
        id,
        tagIds,
        likes,
        comments,
        expiresAt,
        shares,
        publishedAt,
        readingTimeMinutes,
        ...cleanData
    } = data as {
        $schema?: string;
        id?: string;
        slug?: string;
        tagIds?: string[];
        likes?: number;
        comments?: number;
        shares?: number;
        expiresAt?: string;
        publishedAt?: string;
        readingTimeMinutes?: number;
        [key: string]: unknown;
    };

    // Handle expiresAt
    if (data.expiresAt && typeof data.expiresAt === 'string') {
        cleanData.expiresAt = getRandomFutureDate();
    }

    // Handle publishedAt - if provided in seed data, use it; otherwise let it be null
    if (data.publishedAt && typeof data.publishedAt === 'string') {
        cleanData.publishedAt = new Date(data.publishedAt);
    }

    // Handle readingTimeMinutes - if provided in seed data, use it; otherwise use default
    if (data.readingTimeMinutes && typeof data.readingTimeMinutes === 'number') {
        cleanData.readingTimeMinutes = data.readingTimeMinutes;
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
        // biome-ignore lint/performance/noDelete: removing optional property from seed data object when no mapping exists
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
        // biome-ignore lint/performance/noDelete: removing optional property from seed data object when no mapping exists
        delete postData.relatedAccommodationId;
    }

    if (seedRelatedEventId) {
        const realRelatedEventId = context.idMapper.getMappedEventId(seedRelatedEventId);
        if (!realRelatedEventId) {
            throw new Error(`No mapping found for Related Event ID: ${seedRelatedEventId}`);
        }
        postData.relatedEventId = realRelatedEventId;
    } else {
        // biome-ignore lint/performance/noDelete: removing optional property from seed data object when no mapping exists
        delete postData.relatedEventId;
    }

    if (seedAuthorId) {
        // Set the actor to be the owner of the accommodation
        const realAuthorId = context.idMapper.getMappedUserId(seedAuthorId);
        if (realAuthorId) {
            // We need to get the user data to create the actor
            // For now, we'll use a basic actor structure
            // TODO: Get full user data from database if needed
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
 * Posts seed using Seed Factory.
 *
 * HOS-25 T-026: every `example` post gets a stable UUIDv5 derived from its
 * fixture seed-key, so versioned data-migrations can target a specific post
 * by a fixed id. See the audit note on `postNormalizer` above for why this
 * bypasses `PostService._beforeCreate` safely.
 */
export const seedPosts = createSeedFactory({
    entityName: 'Posts',
    serviceClass: PostService,
    folder: 'src/data/post',
    files: exampleManifest.posts,
    normalizer: postNormalizer,
    getEntityInfo: getPostInfo,
    preProcess: preProcessPost,

    deterministicId: {
        modelClass: PostModel,
        getId: getPostFixtureId
    }
});
