import { EventListItemWithRelationsSchema, EventSearchHttpSchema } from '@repo/schemas';
import { EventService } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

export const eventListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List events',
    description: 'Returns a paginated list of events using the EventService',
    tags: ['Events'],
    requestQuery: EventSearchHttpSchema.shape,
    responseSchema: EventListItemWithRelationsSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query as Record<string, unknown>);

        const result = await eventService.list(actor, { page, pageSize });
        if (result.error) throw new Error(result.error.message);

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    },
    options: {
        skipAuth: true,
        skipValidation: true,
        cacheTTL: 60,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
