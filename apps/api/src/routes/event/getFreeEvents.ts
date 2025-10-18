import { EventListItemSchema, HttpEventSearchSchema } from '@repo/schemas';
import { EventService } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

export const getFreeEventsRoute = createListRoute({
    method: 'get',
    path: '/free',
    summary: 'List free events',
    description: 'Returns a paginated list of free events',
    tags: ['Events'],
    requestQuery: HttpEventSearchSchema.pick({
        page: true,
        pageSize: true,
        sortBy: true,
        sortOrder: true,
        q: true,
        city: true,
        category: true,
        startDateAfter: true
    }).shape,
    responseSchema: EventListItemSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = (query || {}) as { page?: number; pageSize?: number };
        const result = await eventService.getFreeEvents(actor, {
            page: page ?? 1,
            pageSize: pageSize ?? 20
        });
        if (result.error) throw new Error(result.error.message);
        return result.data as never;
    },
    options: {
        skipAuth: true,
        skipValidation: true,
        cacheTTL: 60
    }
});
