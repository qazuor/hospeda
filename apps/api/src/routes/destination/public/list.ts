/**
 * Public destination list endpoint
 * Returns paginated list of public destinations
 */
import {
    DestinationPublicSchema,
    DestinationSearchHttpSchema,
    type ServiceErrorCode
} from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * GET /api/v1/public/destinations
 * List destinations - Public endpoint
 */
export const publicListDestinationsRoute = createPublicListRoute({
    method: 'get',
    path: '/',
    summary: 'List destinations',
    description: 'Returns a paginated list of public destinations',
    tags: ['Destinations'],
    requestQuery: DestinationSearchHttpSchema.shape,
    responseSchema: DestinationPublicSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});
        const safeQuery = query || {};

        // Extract hierarchy and other filters from query params
        const searchParams: Record<string, unknown> = { page, pageSize };
        if (safeQuery.q) searchParams.q = safeQuery.q;
        if (safeQuery.isFeatured !== undefined) searchParams.isFeatured = safeQuery.isFeatured;
        if (safeQuery.country) searchParams.country = safeQuery.country;
        if (safeQuery.state) searchParams.state = safeQuery.state;
        if (safeQuery.city) searchParams.city = safeQuery.city;
        if (safeQuery.parentDestinationId)
            searchParams.parentDestinationId = safeQuery.parentDestinationId;
        if (safeQuery.destinationType) searchParams.destinationType = safeQuery.destinationType;
        if (safeQuery.level !== undefined) searchParams.level = safeQuery.level;
        if (safeQuery.ancestorId) searchParams.ancestorId = safeQuery.ancestorId;

        const result = await destinationService.search(
            actor,
            searchParams as Parameters<typeof destinationService.search>[1]
        );

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
