/**
 * Admin PostTag hard-delete endpoint
 * Permanently deletes a PostTag (hard delete only per D-011)
 */
import { PermissionEnum } from '@repo/schemas';
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

/** Response schema for delete confirmation */
const DeleteResponseSchema = z.object({
    success: z.boolean()
});

/**
 * DELETE /api/v1/admin/posts/tags/:id
 * Hard-delete PostTag — Admin endpoint
 *
 * PostTags use hard delete only (D-011). DB FK cascades on `r_post_post_tag.postTagId`
 * remove all post assignments automatically.
 *
 * The caller should call GET /api/v1/admin/posts/tags/:id/impact first and
 * display a confirmation dialog before invoking this endpoint.
 */
export const adminDeletePostTagRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete PostTag (hard delete)',
    description:
        'Permanently deletes a PostTag. DB cascades remove all post assignments. Requires POST_TAG_DELETE permission. Call impact endpoint first to show confirmation.',
    tags: ['PostTags'],
    requiredPermissions: [PermissionEnum.POST_TAG_DELETE],
    requestParams: { id: PostTagIdSchema },
    responseSchema: DeleteResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const result = await postTagService.delete(actor, id);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
