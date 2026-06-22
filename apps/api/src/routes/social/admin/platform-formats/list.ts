/**
 * Admin list social platform formats endpoint.
 * Returns ALL rows (active + inactive), ordered platform asc, publishFormat asc.
 */
import {
    PermissionEnum,
    SocialPlatformFormatAdminSearchSchema,
    SocialPlatformFormatSchema
} from '@repo/schemas';
import { ServiceError, SocialPlatformFormatService } from '@repo/service-core';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../../utils/pagination';
import { createAdminListRoute } from '../../../../utils/route-factory';

const platformFormatService = new SocialPlatformFormatService({ logger: apiLogger });

/**
 * GET /api/v1/admin/social/platform-formats
 * List all social platform format rows (admin) — seed-only, no create/delete.
 * Ordered by platform asc, publishFormat asc via the `sort` query param default.
 */
export const adminListSocialPlatformFormatsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all social platform formats (admin)',
    description:
        'Returns a paginated list of all social platform format configuration rows (active and inactive). ' +
        'These rows are seed-only and cannot be created or deleted via the API.',
    tags: ['Social Platform Formats'],
    requiredPermissions: [PermissionEnum.SOCIAL_PLATFORM_FORMAT_VIEW],
    requestQuery: SocialPlatformFormatAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: SocialPlatformFormatSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        // Default sort: platform asc, publishFormat asc — pass explicit sort when caller omits it
        const queryWithSort = {
            sort: 'platform:asc',
            ...(query || {}),
            page,
            pageSize
        } as Parameters<typeof platformFormatService.adminList>[1];

        const result = await platformFormatService.adminList(actor, queryWithSort);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
