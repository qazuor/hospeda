import { EventOrganizerListItemSchema, EventOrganizerSearchHttpSchema } from '@repo/schemas';
import { EventOrganizerService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

export const eventOrganizerListRoute = createListRoute({
    method: 'get',
    path: '/event-organizers',
    summary: 'List event organizers',
    description: 'Returns a paginated list of event organizers using standardized HTTP schemas',
    tags: ['Event Organizers'],
    requestQuery: EventOrganizerSearchHttpSchema.shape,
    responseSchema: EventOrganizerListItemSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query as Record<string, unknown>);

        const service = new EventOrganizerService({ logger: apiLogger });
        const result = await service.list(actor, {
            page,
            pageSize
        });

        if (result.error) {
            throw new Error(result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
