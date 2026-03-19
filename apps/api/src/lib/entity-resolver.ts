/**
 * @fileoverview
 * Concrete implementation of the {@link EntityResolver} interface.
 * Queries the database for published entities to build {@link EntityChangeData}
 * objects used by the revalidation service for precise path computation.
 *
 * This module lives in the API layer (not service-core) because it depends
 * on concrete Drizzle models and DB schemas.
 */
import {
    events,
    DestinationModel,
    EventModel,
    PostModel,
    accommodations,
    and,
    destinations,
    eq,
    getDb,
    isNull,
    posts
} from '@repo/db';
import { createLogger } from '@repo/logger';
import type { EntityChangeData, EntityResolver } from '@repo/service-core';

const logger = createLogger('entity-resolver');

/** Maximum entities to return per type to prevent runaway queries */
const MAX_ENTITIES_PER_TYPE = 1000;

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
        resolveByType: async ({ entityType }) => {
            try {
                switch (entityType) {
                    case 'accommodation':
                        return await resolveAccommodations();
                    case 'destination':
                        return await resolveDestinations();
                    case 'event':
                        return await resolveEvents();
                    case 'post':
                        return await resolvePosts();
                    case 'accommodation_review':
                    case 'destination_review':
                    case 'tag':
                    case 'amenity':
                        // These types don't have individual detail pages
                        // Return empty so the service falls back to generic listing paths
                        return [];
                    default:
                        logger.warn(
                            `[EntityResolver] Unknown entity type in resolveByType: "${entityType as string}"`
                        );
                        return [];
                }
            } catch (error) {
                logger.error(
                    `[EntityResolver] Failed to resolve entities for type "${entityType}": ${error instanceof Error ? error.message : String(error)}`
                );
                throw error;
            }
        },

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

/** Resolves all published accommodations with their destination slugs */
async function resolveAccommodations(): Promise<ReadonlyArray<EntityChangeData>> {
    const db = getDb();
    const rows = await db
        .select({
            slug: accommodations.slug,
            type: accommodations.type,
            destinationSlug: destinations.slug
        })
        .from(accommodations)
        .leftJoin(destinations, eq(accommodations.destinationId, destinations.id))
        .where(and(isNull(accommodations.deletedAt), eq(accommodations.visibility, 'PUBLIC')))
        .limit(MAX_ENTITIES_PER_TYPE);

    return rows.map((row) => ({
        entityType: 'accommodation' as const,
        slug: row.slug,
        accommodationType: row.type,
        destinationSlug: row.destinationSlug ?? undefined
    }));
}

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

    return {
        entityType: 'accommodation' as const,
        slug: row.slug,
        accommodationType: row.type,
        destinationSlug: row.destinationSlug ?? undefined
    };
}

// ---------------------------------------------------------------------------
// Destination resolvers
// ---------------------------------------------------------------------------

/** Resolves all published destinations */
async function resolveDestinations(): Promise<ReadonlyArray<EntityChangeData>> {
    const db = getDb();
    const rows = await db
        .select({ slug: destinations.slug })
        .from(destinations)
        .where(and(isNull(destinations.deletedAt), eq(destinations.visibility, 'PUBLIC')))
        .limit(MAX_ENTITIES_PER_TYPE);

    return rows.map((row) => ({
        entityType: 'destination' as const,
        slug: row.slug
    }));
}

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

/** Resolves all published events */
async function resolveEvents(): Promise<ReadonlyArray<EntityChangeData>> {
    const db = getDb();
    const rows = await db
        .select({
            slug: events.slug,
            category: events.category
        })
        .from(events)
        .where(and(isNull(events.deletedAt), eq(events.visibility, 'PUBLIC')))
        .limit(MAX_ENTITIES_PER_TYPE);

    return rows.map((row) => ({
        entityType: 'event' as const,
        slug: row.slug,
        category: row.category
    }));
}

/** Resolves a single event by ID */
async function resolveEventById(params: {
    readonly entityId: string;
}): Promise<EntityChangeData | null> {
    const model = new EventModel();
    const entity = await model.findById(params.entityId);
    if (!entity) return null;

    return {
        entityType: 'event' as const,
        slug: entity.slug,
        category: entity.category
    };
}

// ---------------------------------------------------------------------------
// Post resolvers
// ---------------------------------------------------------------------------

/** Resolves all published posts */
async function resolvePosts(): Promise<ReadonlyArray<EntityChangeData>> {
    const db = getDb();
    const rows = await db
        .select({ slug: posts.slug })
        .from(posts)
        .where(and(isNull(posts.deletedAt), eq(posts.visibility, 'PUBLIC')))
        .limit(MAX_ENTITIES_PER_TYPE);

    return rows.map((row) => ({
        entityType: 'post' as const,
        slug: row.slug
    }));
}

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
