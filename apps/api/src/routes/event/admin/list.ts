/**
 * Admin event list endpoint
 * Returns all events with full admin access
 */
import { EventAdminSchema, EventSearchHttpSchema, type ServiceErrorCode } from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * GET /api/v1/admin/events
 * List all events - Admin endpoint
 * Admin permissions allow viewing all events via service-level checks
 */
export const adminListEventsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all events (admin)',
    description: 'Returns a paginated list of all events with full admin details',
    tags: ['Events'],
    requestQuery: EventSearchHttpSchema.shape,
    responseSchema: EventAdminSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        // Use list method with pagination only
        // Admin actor permissions allow full access at service level
        const result = await eventService.list(actor, { page, pageSize });

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
