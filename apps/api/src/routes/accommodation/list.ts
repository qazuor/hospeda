import {
    AccommodationSearchHttpSchema,
    AccommodationWithBasicRelationsSchema,
    type ListRelationsConfig,
    type ServiceErrorCode
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
/**
 * Accommodation list endpoint
 * Uses AccommodationService for real data retrieval with pagination
 */
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

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
 * List accommodations endpoint with pagination
 * Public endpoint that doesn't require authentication
 */
export const accommodationListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List accommodations',
    description: 'Returns a paginated list of accommodations using the AccommodationService',
    tags: ['Accommodations'],
    requestQuery: AccommodationSearchHttpSchema.shape,
    responseSchema: AccommodationWithBasicRelationsSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const parsedQuery = query || {};
        const hasIncludes =
            isTruthyParam(parsedQuery.includeAmenities) ||
            isTruthyParam(parsedQuery.includeFeatures);
        const relations = hasIncludes ? buildRelationsFromQuery(parsedQuery) : undefined;

        /** Build WHERE filters from search-relevant query params */
        const where: Record<string, unknown> = {};
        if (parsedQuery.isFeatured !== undefined) {
            where.isFeatured = isTruthyParam(parsedQuery.isFeatured);
        }
        if (parsedQuery.type !== undefined) {
            where.type = parsedQuery.type;
        }
        if (parsedQuery.destinationId !== undefined) {
            where.destinationId = parsedQuery.destinationId;
        }

        const result = await accommodationService.list(actor, {
            page,
            pageSize,
            ...(relations ? { relations } : {}),
            ...(Object.keys(where).length > 0 ? { where } : {})
        });

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    },
    options: {
        skipAuth: true, // Public endpoint
        skipValidation: true, // Skip header validation for public endpoint
        cacheTTL: 60, // Cache for 1 minute
        customRateLimit: { requests: 200, windowMs: 60000 } // 200 requests per minute
    }
});
