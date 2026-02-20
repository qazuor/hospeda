/**
 * Public accommodation list endpoint
 * Returns paginated list of public accommodations
 */
import {
    AccommodationPublicSchema,
    AccommodationSearchHttpSchema,
    type ListRelationsConfig,
    type ServiceErrorCode
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

        const result = await accommodationService.list(actor, {
            page,
            pageSize,
            ...(relations ? { relations } : {})
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
        cacheTTL: 300, // Cache for 5 minutes
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
