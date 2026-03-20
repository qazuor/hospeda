/**
 * Admin event location list endpoint
 * Returns all event locations with full admin access
 */
import {
    EventLocationAdminSchema,
    EventLocationAdminSearchSchema,
    PermissionEnum
} from '@repo/schemas';
import { EventLocationService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

const eventLocationService = new EventLocationService({ logger: apiLogger });

/**
 * GET /api/v1/admin/event-locations
 * List all event locations - Admin endpoint
 * Admin permissions allow viewing all event locations via service-level checks
 */
export const adminListEventLocationsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all event locations (admin)',
    description: 'Returns a paginated list of all event locations with full admin details',
    tags: ['Event Locations'],
    requiredPermissions: [PermissionEnum.EVENT_LOCATION_VIEW],
    requestQuery: EventLocationAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: EventLocationAdminSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        // Pass all admin search filters to service
        const result = await eventLocationService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
