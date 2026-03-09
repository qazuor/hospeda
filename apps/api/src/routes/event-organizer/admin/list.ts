/**
 * Admin event organizer list endpoint
 * Returns paginated list of all event organizers including deleted ones
 */
import {
    EventOrganizerAdminSchema,
    EventOrganizerAdminSearchSchema,
    PermissionEnum
} from '@repo/schemas';
import { EventOrganizerService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

const eventOrganizerService = new EventOrganizerService({ logger: apiLogger });

/**
 * GET /api/v1/admin/event-organizers
 * List all event organizers (including deleted) - Admin endpoint
 */
export const adminListEventOrganizersRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all event organizers (admin)',
    description: 'Returns a paginated list of all event organizers including soft-deleted ones',
    tags: ['Event Organizers'],
    requiredPermissions: [PermissionEnum.EVENT_ORGANIZER_VIEW],
    requestQuery: EventOrganizerAdminSearchSchema.shape,
    responseSchema: EventOrganizerAdminSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        // Pass all admin search filters to service
        const result = await eventOrganizerService.list(actor, { ...query });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
