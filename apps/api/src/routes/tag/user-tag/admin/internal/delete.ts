/**
 * Admin INTERNAL tag hard-delete endpoint
 * Permanently deletes an INTERNAL tag (hard delete only per D-011)
 *
 * DB FK cascades on `r_entity_tag.tagId` remove all entity assignments automatically.
 * The caller should call GET /api/v1/admin/tags/internal/:id/impact first and display
 * a confirmation dialog before invoking this endpoint.
 *
 * @see SPEC-086 D-011, D-017
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
 * DELETE /api/v1/admin/tags/internal/:id
 * Hard-delete INTERNAL tag — Admin endpoint
 *
 * Permanently deletes the tag. DB cascades remove all entity assignments.
 * Requires TAG_INTERNAL_DELETE permission.
 */
export const adminDeleteInternalTagRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete INTERNAL tag (hard delete)',
    description:
        'Permanently deletes an INTERNAL tag. DB FK cascades remove all entity assignments. Call GET /impact first to show confirmation dialog (D-011). Requires TAG_INTERNAL_DELETE permission.',
    tags: ['Tags', 'Internal'],
    requiredPermissions: [PermissionEnum.TAG_INTERNAL_DELETE],
    requestParams: { id: TagIdSchema },
    responseSchema: DeleteResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        apiLogger.debug(`[adminDeleteInternalTag] actor=${actor.id} tagId=${id}`);

        const result = await tagService.deleteTag(actor, id);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
