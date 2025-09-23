import { z } from '@hono/zod-openapi';
import { EventListItemSchema } from '@repo/schemas';
import { EventService } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

export const getUpcomingEventsRoute = createListRoute({
    method: 'get',
    path: '/upcoming',
    summary: 'List upcoming events',
    description: 'Returns a paginated list of upcoming events between two dates',
    tags: ['Events'],
    requestQuery: {
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        sortBy: z.string().optional(),
        sortOrder: z.enum(['asc', 'desc']).default('asc'),
        q: z.string().optional(),
        daysAhead: z.coerce.number().int().min(1).max(365).default(30),
        city: z.string().optional(),
        country: z.string().optional(),
        maxPrice: z.coerce.number().min(0).optional()
    },
    responseSchema: EventListItemSchema,
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
        if (result.error) throw new Error(result.error.message);
        return result.data as never;
    },
    options: {
        skipAuth: true,
        skipValidation: true,
        cacheTTL: 60
    }
});
