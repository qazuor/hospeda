/**
 * Public get events by location endpoint
 * Returns events at a specific location
 */
import { EventByLocationHttpSchema, EventLocationIdSchema, EventPublicSchema } from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicListRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * GET /api/v1/public/events/location/:locationId
 * List events by location - Public endpoint
 */
export const publicGetEventsByLocationRoute = createPublicListRoute({
    method: 'get',
    path: '/location/{locationId}',
    summary: 'List events by location',
    description: 'Returns a paginated list of events at the specified location',
    tags: ['Events'],
    requestParams: {
        locationId: EventLocationIdSchema
    },
    requestQuery: EventByLocationHttpSchema.shape,
    responseSchema: EventPublicSchema,
    handler: async (ctx, params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { locationId } = params as { locationId: string };
        const { page, pageSize } = (query || {}) as { page?: number; pageSize?: number };
        const result = await eventService.getByLocation(actor, {
            locationId: locationId as unknown as never,
            page: page ?? 1,
            pageSize: pageSize ?? 20
        });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data as never;
    },
    options: {
        cacheTTL: 60
    }
});
