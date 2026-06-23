/**
 * Admin list social settings endpoint.
 * Secret-typed values are masked as '***' by the service layer.
 */
import { PermissionEnum, SocialSettingAdminSearchSchema, SocialSettingSchema } from '@repo/schemas';
import { ServiceError, SocialSettingService } from '@repo/service-core';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../../utils/pagination';
import { createAdminListRoute } from '../../../../utils/route-factory';

const settingService = new SocialSettingService({ logger: apiLogger });

/**
 * GET /api/v1/admin/social/settings
 * List all social settings — Admin endpoint.
 * Secret-typed values are masked as '***' by the service.
 */
export const adminListSocialSettingsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all social settings (admin)',
    description:
        'Returns all social automation pipeline settings. ' +
        'Secret-typed values are masked as "***" in the response.',
    tags: ['Social Settings'],
    requiredPermissions: [PermissionEnum.SOCIAL_SETTINGS_MANAGE],
    requestQuery: SocialSettingAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: SocialSettingSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await settingService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
