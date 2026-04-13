/**
 * Public event location list endpoint
 * Returns paginated list of public event locations
 */
import {
    EventLocationPublicSchema,
    type EventLocationSearchHttp,
    EventLocationSearchHttpSchema
} from '@repo/schemas';
import { EventLocationService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const eventLocationService = new EventLocationService({ logger: apiLogger });

/**
 * GET /api/v1/public/event-locations
 * List event locations - Public endpoint
 */
export const publicListEventLocationsRoute = createPublicListRoute({
    method: 'get',
    path: '/',
    summary: 'List event locations',
    description: 'Returns a paginated list of public event locations',
    tags: ['Event Locations'],
    requestQuery: EventLocationSearchHttpSchema.shape,
    responseSchema: EventLocationPublicSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await eventLocationService.search(actor, {
            ...(query as EventLocationSearchHttp),
            page,
            pageSize
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
