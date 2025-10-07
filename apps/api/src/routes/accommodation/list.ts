import { AccommodationListItemSchema, AccommodationSearchHttpSchema } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
/**
 * Accommodation list endpoint
 * Uses AccommodationService for real data retrieval with pagination
 */
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

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
    responseSchema: AccommodationListItemSchema,
    handler: async (ctx, _params, _body, query) => {
        // Get actor from context (can be guest)
        const actor = getActorFromContext(ctx);

        // Ensure query is defined and has defaults
        const queryParams = query || {};
        const page = Number(queryParams.page) || 1;
        const pageSize = Number(queryParams.pageSize) || 20;

        // Call the real accommodation service with the full query params
        const result = await accommodationService.list(actor, queryParams);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: {
                page,
                pageSize,
                total: result.data?.total || 0,
                totalPages: Math.ceil((result.data?.total || 0) / pageSize)
            }
        };
    },
    options: {
        skipAuth: true, // Public endpoint
        skipValidation: true, // Skip header validation for public endpoint
        cacheTTL: 60, // Cache for 1 minute
        customRateLimit: { requests: 200, windowMs: 60000 } // 200 requests per minute
    }
});
