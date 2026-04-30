/**
 * Admin entity tag assignment — add endpoint
 * Assigns a tag to an entity with per-user attribution
 *
 * Pre-checks enforced by TagService.assignTag() (D-008, D-009):
 * 1. Tag must exist.
 * 2. Tag must be in actor's picker visibility (INTERNAL requires TAG_INTERNAL_VIEW,
 *    USER tag must be owned by actor, SYSTEM allowed for any authenticated actor).
 * 3. Actor must have read access to the target entity.
 * 4. assignedById is injected from actor.id — never caller-provided.
 *
 * Idempotent: double-assigning returns success with wasAlreadyAssigned=true.
 *
 * @see SPEC-086 D-008, D-009, D-017, AC-F04, AC-F07, AC-F08
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

/** Request body for tag assignment */
const AssignTagBodySchema = z.object({
    tagId: z
        .string({ message: 'zodError.common.id.required' })
        .uuid({ message: 'zodError.common.id.invalidUuid' })
});

/** Response schema for assignment confirmation */
const AssignTagResponseSchema = z.object({
    assigned: z.boolean(),
    wasAlreadyAssigned: z.boolean()
});

/**
 * POST /api/v1/admin/entities/:type/:id/tags
 * Assign a tag to an entity — Admin endpoint
 *
 * Creates a per-user assignment row with assignedById=actor.id (D-005).
 * Two different actors assigning the same SYSTEM tag to the same entity
 * each get their own row (AC-F04).
 * Requires TAG_ASSIGN_ADD permission.
 */
export const adminAddEntityTagRoute = createAdminRoute({
    method: 'post',
    path: '/{type}/{id}/tags',
    summary: 'Assign tag to entity',
    description:
        'Assigns a tag to an entity with per-user attribution (assignedById=actor.id, D-005). Picker visibility check (D-008) and entity access check (D-009) are enforced by service. Idempotent — double-assign returns wasAlreadyAssigned=true. Requires TAG_ASSIGN_ADD permission.',
    tags: ['Tags', 'EntityAssignment'],
    requiredPermissions: [PermissionEnum.TAG_ASSIGN_ADD],
    requestParams: {
        type: EntityTypeParamSchema,
        id: EntityIdSchema
    },
    requestBody: AssignTagBodySchema,
    responseSchema: AssignTagResponseSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const entityType = params.type as EntityTypeEnum;
        const entityId = params.id as string;
        const { tagId } = body as z.infer<typeof AssignTagBodySchema>;

        apiLogger.debug(
            `[adminAddEntityTag] actor=${actor.id} entityType=${entityType} entityId=${entityId} tagId=${tagId}`
        );

        const result = await tagService.assignTag(actor, {
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
