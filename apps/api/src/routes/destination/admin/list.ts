/**
 * Admin destination list endpoint
 * Returns all destinations with full admin access
 */
import {
    DestinationAdminListItemSchema,
    DestinationAdminSearchSchema,
    PermissionEnum
} from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * GET /api/v1/admin/destinations
 * List all destinations - Admin endpoint
 * Admin permissions allow viewing all destinations via service-level checks
 */
export const adminListDestinationsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all destinations (admin)',
    description: 'Returns a paginated list of all destinations with full admin details',
    tags: ['Destinations'],
    requiredPermissions: [PermissionEnum.DESTINATION_VIEW_ALL],
    requestQuery: DestinationAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: DestinationAdminListItemSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        // Pass all admin search filters to service
        const result = await destinationService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        // adminList does not hydrate the attractions relation. Batch-load the
        // attraction names for the page so the list can display them.
        const items = result.data?.items ?? [];
        const attractionsMap = await destinationService.getAttractionsMap(
            items.map((destination) => destination.id)
        );
        const itemsWithAttractions = items.map((destination) => ({
            ...destination,
            attractions: (attractionsMap.get(destination.id) ?? []).map((attraction) => ({
                name: attraction.name,
                icon: attraction.icon
            }))
        }));

        return {
            items: itemsWithAttractions,
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
