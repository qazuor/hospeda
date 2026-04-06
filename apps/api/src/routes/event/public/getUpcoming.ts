/**
 * Public get upcoming events endpoint
 * Returns paginated list of upcoming events
 */
import type { EventUpcomingInput } from '@repo/schemas';
import { EventPublicSchema, EventUpcomingHttpSchema } from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * GET /api/v1/public/events/upcoming
 * List upcoming events - Public endpoint
 */
export const publicGetUpcomingEventsRoute = createPublicListRoute({
    method: 'get',
    path: '/upcoming',
    summary: 'List upcoming events',
    description: 'Returns a paginated list of upcoming events between two dates',
    tags: ['Events'],
    requestQuery: EventUpcomingHttpSchema.shape,
    responseSchema: EventPublicSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const input: EventUpcomingInput = {
            page: page ?? 1,
            pageSize: pageSize ?? 20,
            daysAhead: (query?.daysAhead as number) ?? 30,
            city: query?.city as string | undefined,
            country: query?.country as string | undefined,
            category: query?.category as EventUpcomingInput['category'],
            maxPrice: query?.maxPrice as number | undefined
        };

        const result = await eventService.getUpcoming(actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 60
    }
});
