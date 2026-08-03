/**
 * @fileoverview
 * Concrete implementation of the {@link EntityResolver} interface.
 * Queries the database for a single published entity to build the
 * {@link EntityChangeData} the revalidation service maps to cache tags.
 *
 * The bulk `resolveByType` half was removed in HOS-369 W1-1: the collection tag
 * for a type already covers every listing surface that could show one of its
 * members, so enumerating every published row was both redundant and a fast way
 * to exceed Cloudflare's 5-tag-purges-per-minute ceiling.
 *
 * This module lives in the API layer (not service-core) because it depends
 * on concrete Drizzle models and DB schemas.
 */
import {
    accommodations,
    DestinationModel,
    destinations,
    EventModel,
    eq,
    getDb,
    PostModel
} from '@repo/db';
import { createLogger } from '@repo/logger';
import type { EntityChangeData, EntityResolver } from '@repo/service-core';

const logger = createLogger('entity-resolver');

/**
 * Creates a concrete {@link EntityResolver} that queries the database
 * for published entities using Drizzle ORM models.
 *
 * The resolver filters for entities that are:
 * - Not soft-deleted (deletedAt is null)
 * - Publicly visible (visibility = 'PUBLIC')
 *
 * @returns An EntityResolver implementation backed by the database
 *
 * @example
 * ```ts
 * import { createEntityResolver } from './lib/entity-resolver';
 *
 * initializeRevalidationService({
 *     entityResolver: createEntityResolver(),
 *     // ... other params
 * });
 * ```
 */
export function createEntityResolver(): EntityResolver {
    return {
        resolveById: async ({ entityType, entityId }) => {
            try {
                switch (entityType) {
                    case 'accommodation':
                        return await resolveAccommodationById({ entityId });
                    case 'destination':
                        return await resolveDestinationById({ entityId });
                    case 'event':
                        return await resolveEventById({ entityId });
                    case 'post':
                        return await resolvePostById({ entityId });
                    case 'accommodation_review':
                    case 'destination_review':
                    case 'tag':
                    case 'amenity':
                        // These types are not individually resolvable by ID
                        return null;
                    default:
                        logger.warn(
                            `[EntityResolver] Unknown entity type in resolveById: "${entityType as string}"`
                        );
                        return null;
                }
            } catch (error) {
                logger.error(
                    `[EntityResolver] Failed to resolve entity "${entityType}:${entityId}": ${error instanceof Error ? error.message : String(error)}`
                );
                throw error;
            }
        }
    };
}

// ---------------------------------------------------------------------------
// Accommodation resolvers
// ---------------------------------------------------------------------------

/** Resolves a single accommodation by ID */
async function resolveAccommodationById(params: {
    readonly entityId: string;
}): Promise<EntityChangeData | null> {
    const db = getDb();
    const rows = await db
        .select({
            slug: accommodations.slug,
            type: accommodations.type,
            destinationSlug: destinations.slug
        })
        .from(accommodations)
        .leftJoin(destinations, eq(accommodations.destinationId, destinations.id))
        .where(eq(accommodations.id, params.entityId))
        .limit(1);

    const row = rows[0];
    if (!row) return null;

    // `accommodationType` is gone from EntityChangeData: the type-facet pages it
    // used to address (`/alojamientos/tipo/{type}/`) are listings, and the
    // `list-accom` collection tag already covers every one of them (HOS-369 W1-1).
    return {
        entityType: 'accommodation' as const,
        slug: row.slug,
        destinationSlug: row.destinationSlug ?? undefined
    };
}

// ---------------------------------------------------------------------------
// Destination resolvers
// ---------------------------------------------------------------------------

/** Resolves a single destination by ID */
async function resolveDestinationById(params: {
    readonly entityId: string;
}): Promise<EntityChangeData | null> {
    const model = new DestinationModel();
    const entity = await model.findById(params.entityId);
    if (!entity) return null;

    return {
        entityType: 'destination' as const,
        slug: entity.slug
    };
}

// ---------------------------------------------------------------------------
// Event resolvers
// ---------------------------------------------------------------------------

/** Resolves a single event by ID */
async function resolveEventById(params: {
    readonly entityId: string;
}): Promise<EntityChangeData | null> {
    const model = new EventModel();
    const entity = await model.findById(params.entityId);
    if (!entity) return null;

    // `category` dropped for the same reason as `accommodationType` above: the
    // category landing is a listing, covered by the `list-event` collection tag.
    return {
        entityType: 'event' as const,
        slug: entity.slug
    };
}

// ---------------------------------------------------------------------------
// Post resolvers
// ---------------------------------------------------------------------------

/** Resolves a single post by ID */
async function resolvePostById(params: {
    readonly entityId: string;
}): Promise<EntityChangeData | null> {
    const model = new PostModel();
    const entity = await model.findById(params.entityId);
    if (!entity) return null;

    return {
        entityType: 'post' as const,
        slug: entity.slug
    };
}
