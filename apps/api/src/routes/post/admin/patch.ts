/**
 * Admin patch post endpoint
 * Allows admins to partially update any post
 */
import {
    PermissionEnum,
    PostAdminSchema,
    PostIdSchema,
    PostPatchInputSchema,
    type ServiceErrorCode
} from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { transformApiInputToDomain } from '../../../utils/openapi-schema';
import { createAdminRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/posts/:id
 * Partial update post - Admin endpoint
 */
export const adminPatchPostRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update post (admin)',
    description: 'Updates specific fields of any post. Admin only.',
    tags: ['Posts'],
    requiredPermissions: [PermissionEnum.POST_UPDATE],
    requestParams: { id: PostIdSchema },
    requestBody: PostPatchInputSchema,
    responseSchema: PostAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const domainInput = transformApiInputToDomain(body);

        const result = await postService.update(actor, id, domainInput as never);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    },
    options: {
        customRateLimit: { requests: 20, windowMs: 60000 }
    }
});
