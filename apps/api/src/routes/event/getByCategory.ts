import { EventCategoryEnumSchema, EventListItemSchema, HttpPaginationSchema } from '@repo/schemas';
import { EventService } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

export const getEventsByCategoryRoute = createListRoute({
    method: 'get',
    path: '/category/{category}',
    summary: 'List events by category',
    description: 'Returns a paginated list of events for the given category',
    tags: ['Events'],
    requestParams: {
        category: EventCategoryEnumSchema
    },
    requestQuery: HttpPaginationSchema.shape,
    responseSchema: EventListItemSchema,
    handler: async (ctx, params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { category } = params as { category: string };
        const { page, pageSize } = (query || {}) as { page?: number; pageSize?: number };
        const result = await eventService.getByCategory(actor, {
            // biome-ignore lint/suspicious/noExplicitAny: enum passthrough from zod
            category: category as any,
            page: page ?? 1,
            pageSize: pageSize ?? 10,
            sortBy: 'startDate',
            sortOrder: 'asc',
            isPublished: true
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
