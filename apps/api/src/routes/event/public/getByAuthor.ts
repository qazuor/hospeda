/**
 * Public get events by author endpoint
 * Returns events created by a specific author
 */
import { EventByAuthorHttpSchema, EventPublicSchema, UserIdSchema } from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
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
        const { page, pageSize } = extractPaginationParams(query || {});
        const result = await eventService.getByAuthor(actor, {
            // TYPE-WORKAROUND: service input expects branded UserId but route params arrive as plain string; cast bypasses brand-narrowing since validation already happened via UserIdSchema upstream.
            authorId: authorId as unknown as never,
            page,
            pageSize
        });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);

        // The service returns `{ items, total }`; `createPublicListRoute`
        // requires `{ items, pagination }` and throws "Paginated result must
        // have items and pagination properties" otherwise. Returning the
        // service output directly made this route answer 500 for EVERY author
        // — the `as never` cast that used to sit here is what hid the mismatch
        // from the compiler. Mirrors the public post/event list routes.
        return {
            items: result.data?.items ?? [],
            pagination: getPaginationResponse(result.data?.total ?? 0, { page, pageSize })
        } as never;
    },
    options: {
        cacheTTL: 60
    }
});
