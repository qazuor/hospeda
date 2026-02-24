/**
 * Admin get post SEO endpoint
 * Returns SEO metadata for a specific post
 */
import { PermissionEnum, PostIdSchema, SeoSchema, type ServiceErrorCode } from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * GET /api/v1/admin/posts/:id/seo
 * Get SEO metadata for a post - Admin endpoint
 */
export const adminGetPostSeoRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/seo',
    summary: 'Get post SEO metadata (admin)',
    description: 'Retrieves the SEO metadata (title, description, keywords) for a post',
    tags: ['Posts'],
    requiredPermissions: [PermissionEnum.POST_VIEW_ALL],
    requestParams: {
        id: PostIdSchema
    },
    responseSchema: SeoSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await postService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data?.seo ?? null;
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
