/**
 * Public get events by organizer endpoint
 * Returns events by a specific organizer
 */
import { EventOrganizerIdSchema, EventPublicSchema, HttpEventSearchSchema } from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
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
        const { page, pageSize } = extractPaginationParams(query || {});
        const result = await eventService.getByOrganizer(actor, {
            // TYPE-WORKAROUND: service input expects branded EventOrganizerId but route params arrive as plain string; cast bypasses brand-narrowing since the schema already validated upstream.
            organizerId: organizerId as unknown as never,
            page,
            pageSize
        });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);

        // The service returns `{ items, total }`; `createPublicListRoute`
        // requires `{ items, pagination }` and throws "Paginated result must
        // have items and pagination properties" otherwise. Returning the
        // service output directly made this route answer 500 for EVERY
        // organizer — mirrors the fix applied to the sibling public event
        // list routes (getByAuthor, getByLocation).
        return {
            items: result.data?.items ?? [],
            pagination: getPaginationResponse(result.data?.total ?? 0, { page, pageSize })
        } as never;
    },
    options: {
        cacheTTL: 60
    }
});
