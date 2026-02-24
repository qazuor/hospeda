/**
 * Admin get post by ID endpoint
 * Returns full post information including admin fields
 */
import {
    PermissionEnum,
    PostAdminSchema,
    PostIdSchema,
    type ServiceErrorCode
} from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * GET /api/v1/admin/posts/:id
 * Get post by ID - Admin endpoint
 */
export const adminGetPostByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get post by ID (admin)',
    description: 'Retrieves full post information including admin fields',
    tags: ['Posts'],
    requiredPermissions: [PermissionEnum.POST_VIEW_ALL],
    requestParams: {
        id: PostIdSchema
    },
    responseSchema: PostAdminSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await postService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
