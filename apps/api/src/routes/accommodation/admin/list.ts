/**
 * Admin accommodation list endpoint
 * Returns all accommodations with full admin access
 */
import {
    AccommodationAdminSchema,
    AccommodationSearchHttpSchema,
    type ServiceErrorCode
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * GET /api/v1/admin/accommodations
 * List all accommodations - Admin endpoint
 * Admin permissions allow viewing all accommodations via service-level checks
 */
export const adminListAccommodationsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all accommodations (admin)',
    description: 'Returns a paginated list of all accommodations with full admin details',
    tags: ['Accommodations'],
    requestQuery: AccommodationSearchHttpSchema.shape,
    responseSchema: AccommodationAdminSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        // Use list method with pagination only
        // Admin actor permissions allow full access at service level
        const result = await accommodationService.list(actor, { page, pageSize });

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
