/**
 * Admin entity tags list-own endpoint
 * Returns only the calling actor's own assignments for an entity
 *
 * Per D-007: authenticated user A sees only assignments where assignedById = A.id.
 * This is the per-actor scoped view at /admin/entities/:type/:id/tags/own.
 *
 * Distinct from the super-admin attribution view at /admin/entities/:type/:id/tags
 * (entity-attribution.ts, T-026) which returns all assignments with attribution.
 *
 * @see SPEC-086 D-007, D-017, AC-F05
 */
import { EntityTypeEnum, PermissionEnum, TagSchema } from '@repo/schemas';
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

/** Response schema for own entity assignments */
const OwnEntityTagsResponseSchema = z.object({
    tags: z.array(TagSchema),
    entityId: z.string().uuid(),
    entityType: z.string()
});

/**
 * GET /api/v1/admin/entities/:type/:id/tags/own
 * List actor's own tag assignments for an entity — Admin endpoint
 *
 * Returns only assignments where assignedById = actor.id (D-007, AC-F05).
 * Other users' assignments on the same entity are not included.
 * Requires TAG_ASSIGN_VIEW permission.
 */
export const adminListOwnEntityTagsRoute = createAdminRoute({
    method: 'get',
    path: '/{type}/{id}/tags/own',
    summary: 'List own tag assignments for entity',
    description:
        "Returns only the calling actor's own tag assignments for an entity. Per-user scoping per D-007 — other users' assignments are excluded (AC-F05). Requires TAG_ASSIGN_VIEW permission.",
    tags: ['Tags', 'EntityAssignment'],
    requiredPermissions: [PermissionEnum.TAG_ASSIGN_VIEW],
    requestParams: {
        type: EntityTypeParamSchema,
        id: EntityIdSchema
    },
    responseSchema: OwnEntityTagsResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const entityType = params.type as EntityTypeEnum;
        const entityId = params.id as string;

        apiLogger.debug(
            `[adminListOwnEntityTags] actor=${actor.id} entityType=${entityType} entityId=${entityId}`
        );

        // getTagsForEntity scopes to actor.id when actor lacks TAG_VIEW_ALL_ASSIGNMENTS (D-007)
        const result = await tagService.getTagsForEntity(actor, {
            entityId,
            entityType
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            tags: result.data?.tags ?? [],
            entityId,
            entityType
        };
    }
});
