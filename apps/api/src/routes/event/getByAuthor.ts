import { EventByAuthorHttpSchema, EventListItemSchema, UserIdSchema } from '@repo/schemas';
import { EventService } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

export const eventsByAuthorRoute = createListRoute({
    method: 'get',
    path: '/events/author/{authorId}',
    summary: 'Get events by author',
    description: 'Returns events created by a specific author',
    tags: ['Events'],
    requestParams: { authorId: UserIdSchema },
    requestQuery: EventByAuthorHttpSchema.shape,
    responseSchema: EventListItemSchema,
    handler: async (ctx, params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { authorId } = params as { authorId: string };
        const { page, pageSize } = (query || {}) as { page?: number; pageSize?: number };
        const result = await eventService.getByAuthor(actor, {
            authorId: authorId as unknown as never,
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
