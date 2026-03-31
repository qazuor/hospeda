/**
 * Admin sponsorship list endpoint
 * Returns all sponsorships with full admin access
 */
import {
    PermissionEnum,
    SponsorshipAdminSchema,
    SponsorshipAdminSearchSchema
} from '@repo/schemas';
import { ServiceError, SponsorshipService } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

const sponsorshipService = new SponsorshipService({ logger: apiLogger });

/**
 * GET /api/v1/admin/sponsorships
 * List all sponsorships - Admin endpoint
 * Requires SPONSORSHIP_VIEW permission
 */
export const adminListSponsorshipsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all sponsorships (admin)',
    description: 'Returns a paginated list of all sponsorships with full admin details',
    tags: ['Sponsorships'],
    requiredPermissions: [PermissionEnum.SPONSORSHIP_VIEW],
    requestQuery: SponsorshipAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: SponsorshipAdminSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        // Pass all admin search filters to service
        const result = await sponsorshipService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
