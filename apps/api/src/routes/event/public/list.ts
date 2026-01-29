/**
 * Public event list endpoint
 * Returns paginated list of public events
 */
import { EventPublicSchema, EventSearchHttpSchema, type ServiceErrorCode } from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * GET /api/v1/public/events
 * List events - Public endpoint
 */
export const publicListEventsRoute = createPublicListRoute({
    method: 'get',
    path: '/',
    summary: 'List events',
    description: 'Returns a paginated list of public events',
    tags: ['Events'],
    requestQuery: EventSearchHttpSchema.shape,
    responseSchema: EventPublicSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await eventService.list(actor, query || {});

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
