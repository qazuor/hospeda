import {
    EventByLocationHttpSchema,
    EventListItemSchema,
    EventLocationIdSchema
} from '@repo/schemas';
import { EventService } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

export const getEventsByLocationRoute = createListRoute({
    method: 'get',
    path: '/location/{locationId}',
    summary: 'List events by location',
    description: 'Returns a paginated list of events at the specified location',
    tags: ['Events'],
    requestParams: {
        locationId: EventLocationIdSchema
    },
    requestQuery: EventByLocationHttpSchema.shape,
    responseSchema: EventListItemSchema,
    handler: async (ctx, params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { locationId } = params as { locationId: string };
        const { page, pageSize } = (query || {}) as { page?: number; pageSize?: number };
        const result = await eventService.getByLocation(actor, {
            locationId: locationId as unknown as never,
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
