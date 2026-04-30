/**
 * Admin own USER tag hard-delete endpoint
 * Permanently deletes a USER tag owned by the calling actor
 *
 * DB FK cascades remove all assignments referencing the deleted tag.
 * The caller should call GET /api/v1/admin/tags/own/:id/impact first.
 *
 * @see SPEC-086 D-011, D-017, AC-003-02
 */
import { PermissionEnum } from '@repo/schemas';
import { ServiceError, TagService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../../../utils/actor';
import { apiLogger } from '../../../../../utils/logger';
import { createAdminRoute } from '../../../../../utils/route-factory';

const tagService = new TagService({ logger: apiLogger });

/** Path parameter schema for tag ID */
const TagIdSchema = z
    .string({ message: 'zodError.common.id.required' })
    .uuid({ message: 'zodError.common.id.invalidUuid' });

/** Response schema for delete confirmation */
const DeleteResponseSchema = z.object({
    deleted: z.boolean(),
    impactCount: z.number().int().nonnegative()
});

/**
 * DELETE /api/v1/admin/tags/own/:id
 * Hard-delete own USER tag — Admin endpoint
 *
 * Permanently deletes the tag. DB cascades remove all assignments.
 * Service enforces ownership — returns 403 if tag does not belong to actor.
 * Requires TAG_USER_DELETE_OWN permission.
 */
export const adminDeleteOwnTagRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete own USER tag (hard delete)',
    description:
        'Permanently deletes a USER tag owned by the calling actor. DB FK cascades remove all assignments. Service enforces ownership (D-022). Call GET /own/:id/impact first. Requires TAG_USER_DELETE_OWN permission.',
    tags: ['Tags', 'OwnTags'],
    requiredPermissions: [PermissionEnum.TAG_USER_DELETE_OWN],
    requestParams: { id: TagIdSchema },
    responseSchema: DeleteResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        apiLogger.debug(`[adminDeleteOwnTag] actor=${actor.id} tagId=${id}`);

        // deleteTag dispatches by type — TAG_USER_DELETE_OWN checked by service (D-017)
        const result = await tagService.deleteTag(actor, id);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
