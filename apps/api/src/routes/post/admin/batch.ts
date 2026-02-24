/**
 * Admin batch operations endpoint
 * Handles multiple posts operations
 */
import {
    PermissionEnum,
    type PostBatchRequest,
    PostBatchRequestSchema,
    PostBatchResponseSchema
} from '@repo/schemas';
import { PostService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * POST /api/v1/admin/posts/batch
 * Get multiple posts by IDs - Admin endpoint
 */
export const adminPostBatchRoute = createAdminRoute({
    method: 'post',
    path: '/batch',
    summary: 'Get multiple posts by IDs',
    description: 'Retrieves multiple posts by their IDs for entity select components',
    tags: ['Posts'],
    requiredPermissions: [PermissionEnum.POST_VIEW_ALL],
    requestBody: PostBatchRequestSchema,
    responseSchema: PostBatchResponseSchema,
    handler: async (ctx: Context, _params, body: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { ids, fields } = body as PostBatchRequest;

        // Load all posts by their IDs (admin can see deleted)
        const posts = await Promise.all(
            ids.map(async (id) => {
                const result = await postService.getById(actor, id);
                return result.error ? null : result.data;
            })
        );

        // Filter fields if specified
        if (fields && fields.length > 0) {
            // Always include id and title for entity selectors to work
            const requiredFields = ['id', 'title'];
            const fieldsToInclude = [...new Set([...requiredFields, ...fields])];

            return posts.map((post) => {
                if (!post) return null;

                const filtered: Record<string, unknown> = {};
                for (const field of fieldsToInclude) {
                    if (field in post) {
                        filtered[field] = post[field as keyof typeof post];
                    }
                }

                return filtered;
            });
        }

        return posts;
    }
});
