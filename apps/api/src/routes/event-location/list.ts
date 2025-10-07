import { EventLocationListItemSchema, EventLocationSearchHttpSchema } from '@repo/schemas';
import { EventLocationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

export const eventLocationListRoute = createListRoute({
    method: 'get',
    path: '/event-locations',
    summary: 'List event locations',
    description: 'Returns a paginated list of event locations using standardized HTTP schemas',
    tags: ['Event Locations'],
    requestQuery: EventLocationSearchHttpSchema.shape,
    responseSchema: EventLocationListItemSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const q = query as { page?: number; pageSize?: number };
        const page = q.page ?? 1;
        const pageSize = q.pageSize ?? 20;

        const service = new EventLocationService({ logger: apiLogger });
        const result = await service.list(actor, {
            page,
            pageSize
        });

        if (result.error) {
            throw new Error(result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: {
                page,
                pageSize,
                total: result.data?.total || 0,
                totalPages: Math.ceil((result.data?.total || 0) / pageSize)
            }
        };
    }
});
