/**
 * Admin entity tag assignment — remove endpoint
 * Removes the calling actor's own assignment of a tag from an entity
 *
 * Only the actor's OWN assignment is removed. Other users' assignments of
 * the same tag on the same entity are unaffected (per-user attribution model).
 *
 * @see SPEC-086 D-007, D-017, AC-F05
 */
import { EntityTypeEnum, PermissionEnum } from '@repo/schemas';
import { ServiceError, TagService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../../../utils/actor';
import { apiLogger } from '../../../../../utils/logger';
import { createAdminRoute } from '../../../../../utils/route-factory';

const tagService = new TagService({ logger: apiLogger });

/** Path parameter schema for entity type */
const EntityTypeParamSchema = z.nativeEnum(EntityTypeEnum, {
    message: 'Invalid entity type.'
});

/** Path parameter schema for entity ID */
const EntityIdSchema = z
    .string({ message: 'zodError.common.id.required' })
    .uuid({ message: 'zodError.common.id.invalidUuid' });

/** Path parameter schema for tag ID */
const TagIdSchema = z
    .string({ message: 'zodError.common.id.required' })
    .uuid({ message: 'zodError.common.id.invalidUuid' });

/** Response schema for removal confirmation */
const RemoveTagResponseSchema = z.object({
    removed: z.boolean()
});

/**
 * DELETE /api/v1/admin/entities/:type/:id/tags/:tagId
 * Remove own tag assignment from entity — Admin endpoint
 *
 * Removes the calling actor's own assignment. Other users' assignments of the
 * same tag on the same entity remain unaffected (per-user attribution, D-007).
 * Requires TAG_ASSIGN_REMOVE permission.
 */
export const adminRemoveEntityTagRoute = createAdminRoute({
    method: 'delete',
    path: '/{type}/{id}/tags/{tagId}',
    summary: 'Remove own tag assignment from entity',
    description:
        "Removes the calling actor's own tag assignment from an entity. Per-user scoping: only actor's own assignment is removed; other users' assignments are unaffected (D-007). Requires TAG_ASSIGN_REMOVE permission.",
    tags: ['Tags', 'EntityAssignment'],
    requiredPermissions: [PermissionEnum.TAG_ASSIGN_REMOVE],
    requestParams: {
        type: EntityTypeParamSchema,
        id: EntityIdSchema,
        tagId: TagIdSchema
    },
    responseSchema: RemoveTagResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const entityType = params.type as EntityTypeEnum;
        const entityId = params.id as string;
        const tagId = params.tagId as string;

        apiLogger.debug(
            `[adminRemoveEntityTag] actor=${actor.id} entityType=${entityType} entityId=${entityId} tagId=${tagId}`
        );

        const result = await tagService.removeAssignment(actor, {
            tagId,
            entityId,
            entityType
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
