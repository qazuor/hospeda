/**
 * Public event organizer list endpoint
 * Returns paginated list of public event organizers
 */
import { EventOrganizerPublicSchema, EventOrganizerSearchHttpSchema } from '@repo/schemas';
import { EventOrganizerService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const eventOrganizerService = new EventOrganizerService({ logger: apiLogger });

/**
 * GET /api/v1/public/event-organizers
 * List event organizers - Public endpoint
 */
export const publicListEventOrganizersRoute = createPublicListRoute({
    method: 'get',
    path: '/',
    summary: 'List event organizers',
    description: 'Returns a paginated list of public event organizers',
    tags: ['Event Organizers'],
    requestQuery: EventOrganizerSearchHttpSchema.shape,
    responseSchema: EventOrganizerPublicSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await eventOrganizerService.list(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 300, // Cache for 5 minutes
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
