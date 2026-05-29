/**
 * Admin accommodation list endpoint
 * Returns all accommodations with full admin access
 */
import { AccommodationAdminSchema, AccommodationAdminSearchSchema } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * GET /api/v1/admin/accommodations
 * List accommodations - Admin endpoint.
 *
 * SPEC-169 §5.2: the entity-specific permission (ACCOMMODATION_VIEW_ALL OR
 * ACCOMMODATION_VIEW_OWN) is enforced in the service (`_canAdminList` → `checkCanAdminList`),
 * which ALSO forces owner-scoping (`ownerId = actor.id`) for VIEW_OWN-only actors. The route
 * gate therefore only requires admin access (verified by the admin authorization middleware):
 * declaring VIEW_ALL here would impose AND-semantics on the permission list and 403 a
 * legitimate VIEW_OWN host. The OR decision lives in the service, the single source of truth.
 */
export const adminListAccommodationsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List accommodations (admin)',
    description: 'Returns a paginated list of accommodations with full admin details',
    tags: ['Accommodations'],
    requestQuery: AccommodationAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: AccommodationAdminSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        // Pass all admin search filters to service
        const result = await accommodationService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
