/**
 * Admin PostTag patch endpoint
 * Updates an existing PostTag (PATCH — partial update)
 */
import {
    PermissionEnum,
    PostTagSchema,
    type UpdatePostTagInput,
    UpdatePostTagSchema
} from '@repo/schemas';
import { PostTagService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const postTagService = new PostTagService({ logger: apiLogger });

/** Path parameter schema for PostTag ID */
const PostTagIdSchema = z
    .string({ message: 'zodError.common.id.required' })
    .uuid({ message: 'zodError.common.id.invalidUuid' });

/**
 * PATCH /api/v1/admin/posts/tags/:id
 * Update PostTag — Admin endpoint
 */
export const adminPatchPostTagRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Update PostTag',
    description:
        'Partially updates a PostTag by ID. Requires POST_TAG_UPDATE permission. Slug and name uniqueness is enforced.',
    tags: ['PostTags'],
    requiredPermissions: [PermissionEnum.POST_TAG_UPDATE],
    requestParams: { id: PostTagIdSchema },
    requestBody: UpdatePostTagSchema,
    responseSchema: PostTagSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const data = body as UpdatePostTagInput;

        const result = await postTagService.update(actor, id, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
