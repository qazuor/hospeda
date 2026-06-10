/**
 * Admin list moderation thresholds endpoint
 */
import { PermissionEnum, contentModerationThresholdSchema } from '@repo/schemas';
import { ContentModerationThresholdService, ServiceError } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../../utils/pagination';
import { createAdminListRoute } from '../../../../utils/route-factory';

/**
 * GET /api/v1/admin/content-moderation/thresholds
 * List moderation thresholds - Admin endpoint.
 */
export const adminListThresholdsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List moderation thresholds (admin)',
    description: 'Returns a paginated list of content moderation thresholds',
    tags: ['Content Moderation'],
    requiredPermissions: [PermissionEnum.MODERATION_THRESHOLD_VIEW],
    responseSchema: z.object({
        items: z.array(contentModerationThresholdSchema),
        pagination: z.object({
            page: z.number(),
            pageSize: z.number(),
            total: z.number(),
            totalPages: z.number()
        })
    }),
    handler: async (ctx, _params, _body, query) => {
        const thresholdService = new ContentModerationThresholdService({ logger: apiLogger });
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await thresholdService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
