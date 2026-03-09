/**
 * Public get events by author endpoint
 * Returns events created by a specific author
 */
import { EventByAuthorHttpSchema, EventPublicSchema, UserIdSchema } from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicListRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * GET /api/v1/public/events/author/:authorId
 * Get events by author - Public endpoint
 */
export const publicGetEventsByAuthorRoute = createPublicListRoute({
    method: 'get',
    path: '/author/{authorId}',
    summary: 'Get events by author',
    description: 'Returns events created by a specific author',
    tags: ['Events'],
    requestParams: { authorId: UserIdSchema },
    requestQuery: EventByAuthorHttpSchema.shape,
    responseSchema: EventPublicSchema,
    handler: async (ctx, params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { authorId } = params as { authorId: string };
        const { page, pageSize } = (query || {}) as { page?: number; pageSize?: number };
        const result = await eventService.getByAuthor(actor, {
            authorId: authorId as unknown as never,
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
