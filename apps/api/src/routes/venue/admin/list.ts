/**
 * Admin venue list endpoint
 * Returns all venue listings with full admin access.
 */
import { VenueAdminListItemSchema, VenueAdminSearchSchema } from '@repo/schemas';
import { ServiceError, VenueService } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });

/**
 * GET /api/v1/admin/venues
 * List venue listings — Admin endpoint.
 *
 * Permission model: the entity-specific permission (VENUE_VIEW_ALL) is
 * enforced in the service (`_canAdminList` → `checkVenueCanAdminList`).
 * The route gate only requires admin-panel access, matching the accommodation
 * admin list pattern.
 */
export const adminListVenuesRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List gastronomy listings (admin)',
    description: 'Returns a paginated list of gastronomy listings with full admin details',
    tags: ['Venue'],
    requestQuery: VenueAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: VenueAdminListItemSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await venueService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
