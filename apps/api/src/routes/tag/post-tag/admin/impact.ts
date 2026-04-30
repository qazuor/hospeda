/**
 * Admin PostTag impact count endpoint
 * Returns the count of posts that reference a given PostTag (pre-delete confirmation)
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

/** Response schema for the impact count */
const ImpactResponseSchema = z.object({
    count: z.number().int().nonnegative()
});

/**
 * GET /api/v1/admin/posts/tags/:id/impact
 * Get PostTag impact count — Admin endpoint
 *
 * Returns the number of posts that currently reference this PostTag.
 * Intended for the two-step delete-confirmation UX (D-011):
 *  1. UI calls this endpoint to retrieve the count.
 *  2. UI shows confirmation dialog with the count.
 *  3. On confirm, UI calls DELETE /api/v1/admin/posts/tags/:id.
 */
export const adminGetPostTagImpactRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/impact',
    summary: 'Get PostTag impact count',
    description:
        'Returns the number of posts that reference this PostTag. Use before delete to show confirmation dialog.',
    tags: ['PostTags'],
    requiredPermissions: [PermissionEnum.POST_TAG_VIEW],
    requestParams: { id: PostTagIdSchema },
    responseSchema: ImpactResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const result = await postTagService.getImpactCount(actor, id);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
