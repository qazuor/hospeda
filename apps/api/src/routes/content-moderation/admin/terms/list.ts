/**
 * Admin list moderation terms endpoint
 * Returns paginated terms with full admin access
 */
import {
    PermissionEnum,
    contentModerationTermAdminSearchSchema,
    contentModerationTermSchema
} from '@repo/schemas';
import { ContentModerationTermService, ServiceError } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../../utils/pagination';
import { createAdminListRoute } from '../../../../utils/route-factory';

/**
 * GET /api/v1/admin/content-moderation/terms
 * List moderation terms - Admin endpoint.
 */
export const adminListTermsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List moderation terms (admin)',
    description: 'Returns a paginated list of content moderation terms with admin details',
    tags: ['Content Moderation'],
    requiredPermissions: [PermissionEnum.MODERATION_TERM_VIEW],
    requestQuery: contentModerationTermAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: z.object({
        items: z.array(contentModerationTermSchema),
        pagination: z.object({
            page: z.number(),
            pageSize: z.number(),
            total: z.number(),
            totalPages: z.number()
        })
    }),
    handler: async (ctx, _params, _body, query) => {
        const termService = new ContentModerationTermService({ logger: apiLogger });
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await termService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
