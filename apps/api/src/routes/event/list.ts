import { EventListItemSchema, HttpEventSearchSchema } from '@repo/schemas';
import { EventService } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

export const eventListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List events',
    description: 'Returns a paginated list of events using the EventService',
    tags: ['Events'],
    requestQuery: HttpEventSearchSchema.shape, // ✅ Using @repo/schemas
    responseSchema: EventListItemSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const queryData = query as { page?: number; pageSize?: number };
        const page = queryData.page ?? 1;
        const pageSize = queryData.pageSize ?? 20;

        const result = await eventService.list(actor, { page, pageSize });
        if (result.error) throw new Error(result.error.message);

        return {
            items: result.data?.items || [],
            pagination: {
                page,
                pageSize,
                total: result.data?.total || 0,
                totalPages: Math.ceil((result.data?.total || 0) / pageSize)
            }
        };
    },
    options: {
        skipAuth: true,
        skipValidation: true,
        cacheTTL: 60,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
