/**
 * Protected patch post endpoint
 * Requires authentication and ownership
 */
import {
    httpToDomainPostPatch,
    PermissionEnum,
    PostIdSchema,
    type PostPatchHttp,
    PostPatchHttpSchema,
    PostProtectedSchema
} from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * PATCH /api/v1/protected/posts/:id
 * Patch post - Protected endpoint
 */
export const protectedPatchPostRoute = createProtectedRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Patch post',
    description: 'Partially updates a post. Requires authorship or POST_UPDATE permission.',
    tags: ['Posts'],
    requestParams: { id: PostIdSchema },
    requestBody: PostPatchHttpSchema,
    responseSchema: PostProtectedSchema,
    ownership: {
        entityType: 'post',
        ownershipFields: ['authorId'],
        bypassPermission: PermissionEnum.POST_UPDATE
    },
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        // Convert HTTP input to domain input
        const domainInput = httpToDomainPostPatch(body as PostPatchHttp);
        const result = await postService.update(actor, id, domainInput);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
