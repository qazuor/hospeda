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
    experiences,
    gastronomies,
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
                    case 'gastronomy':
                    case 'experience':
                        return await resolveCommerceListingById({ entityType, entityId });
                    case 'accommodation_review':
                    case 'destination_review':
                    case 'tag':
                    case 'amenity':
                    case 'pointOfInterest':
                    case 'attraction':
                    case 'partner':
                        // Not individually resolvable by ID here. The first four
                        // have no detail page of their own; the last three do,
                        // but nothing calls this resolver for them yet — they
                        // are listed so a future caller lands on a deliberate
                        // `null` instead of the "unknown entity type" warning
                        // below, which would read like a typo rather than an
                        // unimplemented case.
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
// Commerce listing resolvers
// ---------------------------------------------------------------------------

/**
 * Resolves a single commerce listing (gastronomy or experience) by ID.
 *
 * One function for both verticals because they are the same shape to the cache:
 * a detail page, a listing page, and an optional parent destination whose page
 * surfaces them. The tag mapper already treats them as one arm for exactly that
 * reason, so splitting them here would be two copies of one query.
 *
 * `id` is returned alongside `slug` because the commerce cache tags are built
 * from both — the same pair the automatic purge path emits, so a manual
 * revalidation evicts precisely what a photo upload would have.
 *
 * @param params.entityType - Which vertical to read, and the discriminant of the returned data.
 * @param params.entityId - The listing's UUID.
 * @returns The change data for the listing, or `null` when no such row exists.
 */
async function resolveCommerceListingById(params: {
    readonly entityType: 'gastronomy' | 'experience';
    readonly entityId: string;
}): Promise<EntityChangeData | null> {
    const table = params.entityType === 'gastronomy' ? gastronomies : experiences;

    const db = getDb();
    const rows = await db
        .select({
            slug: table.slug,
            destinationSlug: destinations.slug
        })
        .from(table)
        .leftJoin(destinations, eq(table.destinationId, destinations.id))
        .where(eq(table.id, params.entityId))
        .limit(1);

    const row = rows[0];
    if (!row) return null;

    return {
        entityType: params.entityType,
        id: params.entityId,
        slug: row.slug,
        destinationSlug: row.destinationSlug ?? undefined
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
