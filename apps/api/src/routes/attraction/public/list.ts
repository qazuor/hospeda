/**
 * Public attraction list endpoint
 * Returns paginated list of public attractions
 */
import { AttractionPublicSchema, AttractionSearchHttpSchema } from '@repo/schemas';
import { AttractionService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const attractionService = new AttractionService({ logger: apiLogger });

/**
 * GET /api/v1/public/attractions
 * List attractions - Public endpoint
 */
export const publicListAttractionsRoute = createPublicListRoute({
    method: 'get',
    path: '/',
    summary: 'List attractions',
    description: 'Returns a paginated list of public attractions',
    tags: ['Attractions'],
    requestQuery: AttractionSearchHttpSchema.shape,
    responseSchema: AttractionPublicSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await attractionService.list(actor, query || {});

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
