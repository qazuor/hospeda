/**
 * Public get upcoming events endpoint
 * Returns paginated list of upcoming events
 */
import { EventPublicSchema, EventUpcomingHttpSchema } from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicListRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * GET /api/v1/public/events/upcoming
 * List upcoming events - Public endpoint
 */
export const publicGetUpcomingEventsRoute = createPublicListRoute({
    method: 'get',
    path: '/upcoming',
    summary: 'List upcoming events',
    description: 'Returns a paginated list of upcoming events between two dates',
    tags: ['Events'],
    requestQuery: EventUpcomingHttpSchema.shape,
    responseSchema: EventPublicSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { daysAhead, city, country, maxPrice, page, pageSize } = (query || {}) as {
            daysAhead?: number;
            city?: string;
            country?: string;
            maxPrice?: number;
            page?: number;
            pageSize?: number;
        };
        const result = await eventService.getUpcoming(actor, {
            daysAhead: daysAhead ?? 30,
            city,
            country,
            maxPrice,
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
