/**
 * Admin sponsorship level list endpoint
 * Returns all sponsorship levels with admin access.
 *
 * SPEC-117 follow-up #2: previously absent; the Levels tab on
 * /billing/sponsorships rendered "Route not found" because this handler
 * did not exist.
 */
import {
    PermissionEnum,
    SponsorshipLevelSchema,
    SponsorshipLevelSearchSchema
} from '@repo/schemas';
import { ServiceError, SponsorshipLevelService } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

const sponsorshipLevelService = new SponsorshipLevelService({ logger: apiLogger });

/**
 * GET /api/v1/admin/sponsorship-levels
 * List all sponsorship levels - Admin endpoint
 */
export const adminListSponsorshipLevelsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all sponsorship levels (admin)',
    description: 'Returns a paginated list of all sponsorship levels',
    tags: ['Sponsorships'],
    requiredPermissions: [PermissionEnum.SPONSORSHIP_VIEW],
    requestQuery: SponsorshipLevelSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: SponsorshipLevelSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await sponsorshipLevelService.list(actor, {
            page,
            pageSize,
            ...(query || {})
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
