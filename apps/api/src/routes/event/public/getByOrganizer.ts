/**
 * Public get events by organizer endpoint
 * Returns events by a specific organizer
 */
import { EventOrganizerIdSchema, EventPublicSchema, HttpEventSearchSchema } from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicListRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * GET /api/v1/public/events/organizer/:organizerId
 * List events by organizer - Public endpoint
 */
export const publicGetEventsByOrganizerRoute = createPublicListRoute({
    method: 'get',
    path: '/organizer/{organizerId}',
    summary: 'List events by organizer',
    description: 'Returns a paginated list of events by the specified organizer',
    tags: ['Events'],
    requestParams: {
        organizerId: EventOrganizerIdSchema
    },
    requestQuery: HttpEventSearchSchema.pick({
        page: true,
        pageSize: true,
        sortBy: true,
        sortOrder: true,
        q: true
    }).shape,
    responseSchema: EventPublicSchema,
    handler: async (ctx, params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { organizerId } = params as { organizerId: string };
        const { page, pageSize } = (query || {}) as { page?: number; pageSize?: number };
        const result = await eventService.getByOrganizer(actor, {
            organizerId: organizerId as unknown as never,
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
