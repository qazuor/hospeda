/**
 * Admin list social publish logs endpoint — SPEC-254 T-037.
 *
 * GET /api/v1/admin/social/publish-logs
 * Returns a paginated list of dispatch attempt log entries.
 */
import {
    PermissionEnum,
    SocialPublishLogAdminSearchSchema,
    SocialPublishLogSchema
} from '@repo/schemas';
import { ServiceError, SocialPublishLogService } from '@repo/service-core';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../../utils/pagination';
import { createAdminListRoute } from '../../../../utils/route-factory';

const publishLogService = new SocialPublishLogService({ logger: apiLogger });

/**
 * GET /api/v1/admin/social/publish-logs
 * List social publish logs — Admin endpoint.
 */
export const adminListSocialPublishLogsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List social publish logs (admin)',
    description:
        'Returns a paginated list of dispatch attempt log entries ordered by createdAt DESC. ' +
        'Supports filtering by postId, targetId, status, and platform.',
    tags: ['Social Publish Logs'],
    requiredPermissions: [PermissionEnum.SOCIAL_PUBLISH_LOG_VIEW],
    requestQuery: SocialPublishLogAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: SocialPublishLogSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});
        const q = query as Record<string, unknown> | undefined;

        const result = await publishLogService.list({
            actor,
            filters: {
                page,
                pageSize,
                postId: q?.postId as string | undefined,
                targetId: q?.targetId as string | undefined,
                status: q?.status as string | undefined,
                platform: q?.platform as string | undefined
            }
        });

        if (result.error) {
            throw new ServiceError(
                result.error.code,
                result.error.message,
                undefined,
                result.error.reason
            );
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
