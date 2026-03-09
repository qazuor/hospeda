/**
 * Public accommodation list endpoint
 * Returns paginated list of public accommodations with filtering, search, and sorting.
 *
 * Supported filters:
 * - type: accommodation type (direct column match)
 * - isFeatured: featured flag (direct column match)
 * - destinationId: filter by destination (direct column match)
 * - q: text search on name (ilike)
 * - sortBy/sortOrder: sorting on direct table columns
 * - includeAmenities/includeFeatures: relation includes
 */
import {
    AccommodationPublicSchema,
    AccommodationSearchHttpSchema,
    type ListRelationsConfig
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/** Check if a query param value is truthy (handles both boolean and string from Zod transform) */
function isTruthyParam(value: unknown): boolean {
    return value === true || value === 'true';
}

/**
 * Builds a relations config object from include boolean query params.
 * Merges with the default service relations (destination, owner).
 */
function buildRelationsFromQuery(query: Record<string, unknown>): ListRelationsConfig {
    const relations: Record<string, boolean | Record<string, unknown>> = {
        destination: true,
        owner: true
    };

    if (isTruthyParam(query.includeAmenities)) {
        relations.amenities = { amenity: true };
    }

    if (isTruthyParam(query.includeFeatures)) {
        relations.features = { feature: true };
    }

    return relations;
}

/**
 * Builds a where clause from query params that map to direct table columns.
 * Uses the _like suffix convention for text search fields.
 * Only includes params that have actual values (not undefined/null).
 */
function buildWhereFromQuery(query: Record<string, unknown>): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    // Direct column filters
    if (query.type && typeof query.type === 'string') {
        where.type = query.type;
    }
    if (query.isFeatured !== undefined) {
        where.isFeatured = isTruthyParam(query.isFeatured);
    }
    if (query.destinationId && typeof query.destinationId === 'string') {
        where.destinationId = query.destinationId;
    }

    // Text search using _like suffix (triggers ilike in buildWhereClause)
    if (query.q && typeof query.q === 'string' && query.q.trim().length > 0) {
        where.name_like = query.q.trim();
    }

    return where;
}

/** Allowed sort fields for public accommodation list */
const ALLOWED_SORT_FIELDS = new Set([
    'name',
    'createdAt',
    'averageRating',
    'reviewsCount',
    'isFeatured'
]);

/**
 * Extracts and validates sorting params from query.
 * Returns undefined values if sort field is not in the allowed list.
 */
function extractSortParams(query: Record<string, unknown>): {
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
} {
    const sortBy = typeof query.sortBy === 'string' ? query.sortBy : undefined;
    const sortOrder =
        query.sortOrder === 'asc' || query.sortOrder === 'desc' ? query.sortOrder : undefined;

    if (sortBy && ALLOWED_SORT_FIELDS.has(sortBy)) {
        return { sortBy, sortOrder: sortOrder ?? 'asc' };
    }

    return {};
}

/**
 * GET /api/v1/public/accommodations
 * List accommodations - Public endpoint
 */
export const publicListAccommodationsRoute = createPublicListRoute({
    method: 'get',
    path: '/',
    summary: 'List accommodations',
    description: 'Returns a paginated list of public accommodations',
    tags: ['Accommodations'],
    requestQuery: AccommodationSearchHttpSchema.shape,
    responseSchema: AccommodationPublicSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const parsedQuery = query || {};
        const hasIncludes =
            isTruthyParam(parsedQuery.includeAmenities) ||
            isTruthyParam(parsedQuery.includeFeatures);
        const relations = hasIncludes ? buildRelationsFromQuery(parsedQuery) : undefined;

        // Build where clause from supported direct-column filters + text search
        const where = buildWhereFromQuery(parsedQuery);
        const hasWhere = Object.keys(where).length > 0;

        // Extract validated sorting params
        const { sortBy, sortOrder } = extractSortParams(parsedQuery);

        const result = await accommodationService.list(actor, {
            page,
            pageSize,
            ...(relations ? { relations } : {}),
            ...(hasWhere ? { where } : {}),
            ...(sortBy ? { sortBy, sortOrder } : {})
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 300, // Cache for 5 minutes
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
