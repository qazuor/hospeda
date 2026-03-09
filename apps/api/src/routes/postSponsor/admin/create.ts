/**
 * Admin create post sponsor endpoint
 * Allows admins to create new post sponsors
 */
import {
    PermissionEnum,
    type PostSponsorCreateInput,
    PostSponsorCreateInputSchema,
    PostSponsorSchema
} from '@repo/schemas';
import { PostSponsorService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const postSponsorService = new PostSponsorService({ logger: apiLogger });

/**
 * POST /api/v1/admin/post-sponsors
 * Create post sponsor - Admin endpoint
 */
export const adminCreatePostSponsorRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create post sponsor',
    description: 'Creates a new post sponsor. Admin only.',
    tags: ['Post Sponsors'],
    requiredPermissions: [PermissionEnum.POST_SPONSOR_CREATE],
    requestBody: PostSponsorCreateInputSchema,
    responseSchema: PostSponsorSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const data = body as PostSponsorCreateInput;
        const result = await postSponsorService.create(actor, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
