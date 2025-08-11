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
        fromDate: z.string().datetime().optional().default(new Date().toISOString()),
        toDate: z.string().datetime().optional(),
        page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
        limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional()
    },
    responseSchema: EventListItemSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { fromDate, toDate, page, limit } = (query || {}) as {
            fromDate?: string;
            toDate?: string;
            page?: number;
            limit?: number;
        };
        const result = await eventService.getUpcoming(actor, {
            fromDate: fromDate ? new Date(fromDate) : new Date(),
            toDate: toDate ? new Date(toDate) : undefined,
            page,
            pageSize: limit
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
