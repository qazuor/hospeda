import { z } from '@hono/zod-openapi';
import { EventListItemSchema, UserIdSchema } from '@repo/schemas';
import { EventService } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

export const getEventsByAuthorRoute = createListRoute({
    method: 'get',
    path: '/author/{authorId}',
    summary: 'List events by author',
    description: 'Returns a paginated list of events authored by the specified user',
    tags: ['Events'],
    requestParams: {
        authorId: UserIdSchema
    },
    requestQuery: {
        page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
        limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional()
    },
    responseSchema: EventListItemSchema,
    handler: async (ctx, params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { authorId } = params as { authorId: string };
        const { page, limit } = (query || {}) as { page?: number; limit?: number };
        const result = await eventService.getByAuthor(actor, {
            authorId: authorId as unknown as never,
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
