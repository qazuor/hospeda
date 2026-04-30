/**
 * Admin PostTag get-by-ID endpoint
 * Returns a single PostTag by its UUID
 */
import { PostTagModel } from '@repo/db';
import { PermissionEnum, PostTagSchema, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

/** Path parameter schema for PostTag ID */
const PostTagIdSchema = z
    .string({ message: 'zodError.common.id.required' })
    .uuid({ message: 'zodError.common.id.invalidUuid' });

/**
 * GET /api/v1/admin/posts/tags/:id
 * Get PostTag by ID — Admin endpoint
 *
 * PostTagService does not expose a public getById method (T-017 scope).
 * The route checks the actor's permission directly and calls the model.
 * This is consistent with the project pattern for lightweight admin read routes.
 */
export const adminGetPostTagByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get PostTag by ID (admin)',
    description: 'Retrieves a single PostTag by its UUID. Requires POST_TAG_VIEW permission.',
    tags: ['PostTags'],
    requiredPermissions: [PermissionEnum.POST_TAG_VIEW],
    requestParams: { id: PostTagIdSchema },
    responseSchema: PostTagSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        if (!actor.permissions.includes(PermissionEnum.POST_TAG_VIEW)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: POST_TAG_VIEW required'
            );
        }

        apiLogger.debug(`[adminGetPostTagById] actor=${actor.id} postTagId=${id}`);

        // Lazy instantiation: deferring construction until handler invocation keeps
        // tests that boot the app but don't exercise this route from needing
        // PostTagModel in their local @repo/db mock.
        const postTagModel = new PostTagModel();
        const tag = await postTagModel.findById(id);

        if (!tag) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, `PostTag not found: ${id}`);
        }

        return tag;
    }
});
