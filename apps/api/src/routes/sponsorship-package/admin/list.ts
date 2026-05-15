/**
 * Admin sponsorship package list endpoint
 * Returns all sponsorship packages with admin access.
 *
 * SPEC-117 follow-up #2: previously absent; the Packages tab on
 * /billing/sponsorships rendered "Route not found" because this handler
 * did not exist.
 */
import {
    PermissionEnum,
    SponsorshipPackageSchema,
    SponsorshipPackageSearchSchema
} from '@repo/schemas';
import { ServiceError, SponsorshipPackageService } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

const sponsorshipPackageService = new SponsorshipPackageService({ logger: apiLogger });

/**
 * GET /api/v1/admin/sponsorship-packages
 * List all sponsorship packages - Admin endpoint
 */
export const adminListSponsorshipPackagesRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all sponsorship packages (admin)',
    description: 'Returns a paginated list of all sponsorship packages',
    tags: ['Sponsorships'],
    requiredPermissions: [PermissionEnum.SPONSORSHIP_VIEW],
    requestQuery: SponsorshipPackageSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: SponsorshipPackageSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await sponsorshipPackageService.list(actor, {
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
