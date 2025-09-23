import { z } from '@hono/zod-openapi';
import { EventListItemSchema, EventOrganizerIdSchema } from '@repo/schemas';
import { EventService } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

export const getEventsByOrganizerRoute = createListRoute({
    method: 'get',
    path: '/organizer/{organizerId}',
    summary: 'List events by organizer',
    description: 'Returns a paginated list of events by the specified organizer',
    tags: ['Events'],
    requestParams: {
        organizerId: EventOrganizerIdSchema
    },
    requestQuery: {
        page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
        pageSize: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
        sortBy: z.string().optional(),
        sortOrder: z.enum(['asc', 'desc']).optional(),
        q: z.string().optional()
    },
    responseSchema: EventListItemSchema,
    handler: async (ctx, params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { organizerId } = params as { organizerId: string };
        const { page, pageSize } = (query || {}) as { page?: number; pageSize?: number };
        const result = await eventService.getByOrganizer(actor, {
            organizerId: organizerId as unknown as never,
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
