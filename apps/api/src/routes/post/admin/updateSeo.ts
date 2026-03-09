/**
 * Admin update post SEO endpoint
 * Updates SEO metadata for a specific post
 */
import { PermissionEnum, PostAdminSchema, PostIdSchema, SeoSchema } from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/posts/:id/seo
 * Update SEO metadata for a post - Admin endpoint
 */
export const adminUpdatePostSeoRoute = createAdminRoute({
    method: 'put',
    path: '/{id}/seo',
    summary: 'Update post SEO metadata (admin)',
    description: 'Updates the SEO metadata (title, description, keywords) for a post. Admin only.',
    tags: ['Posts'],
    requiredPermissions: [PermissionEnum.POST_UPDATE],
    requestParams: {
        id: PostIdSchema
    },
    requestBody: SeoSchema,
    responseSchema: PostAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const result = await postService.update(actor, id as string, { seo: body });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
