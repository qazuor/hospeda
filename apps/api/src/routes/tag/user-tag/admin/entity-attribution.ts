/**
 * Admin entity tag attribution endpoint (super-admin)
 *
 * GET /api/v1/admin/entities/:type/:id/tags
 * Returns ALL tag assignments for an entity with full attribution (assignedById
 * populated). This is the super-admin cross-user attribution view (D-007, AC-F06).
 *
 * Distinct from the per-actor view at /api/v1/admin/entities/:type/:id/tags/own
 * (T-028) which returns only the calling actor's own assignments.
 *
 * @see SPEC-086 D-007, D-017, AC-F05, AC-F06, AC-007-01, AC-007-02
 */
import { EntityTypeEnum, PermissionEnum, TagSchema } from '@repo/schemas';
import { ServiceError, TagService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../../utils/actor';
import { createRouter } from '../../../../utils/create-app';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const tagService = new TagService({ logger: apiLogger });

/** Path parameter schema for entity type */
const EntityTypeParamSchema = z.nativeEnum(EntityTypeEnum, {
    message: 'Invalid entity type. Must be one of the supported EntityTypeEnum values.'
});

/** Path parameter schema for entity ID */
const EntityIdSchema = z
    .string({ message: 'zodError.common.id.required' })
    .uuid({ message: 'zodError.common.id.invalidUuid' });

/** Response schema for the attribution view */
const EntityTagsAttributionResponseSchema = z.object({
    tags: z.array(TagSchema),
    entityId: z.string().uuid(),
    entityType: z.string()
});

/**
 * GET /api/v1/admin/entities/:type/:id/tags
 * Full attribution view — Super-admin endpoint
 *
 * Returns ALL tag assignments for the entity with assignedById populated.
 * This is the cross-user attribution view (D-007):
 * - Super-admin with TAG_VIEW_ALL_ASSIGNMENTS sees all assignments + attribution.
 * - Actors without TAG_VIEW_ALL_ASSIGNMENTS → 403.
 *
 * Note: per-actor own assignments are at /admin/entities/:type/:id/tags/own (T-028).
 */
const adminGetEntityTagAttributionRoute = createAdminRoute({
    method: 'get',
    path: '/{type}/{id}/tags',
    summary: 'Get all entity tag assignments with attribution (super-admin)',
    description:
        'Returns all tag assignments for an entity with full attribution (assignedById per row). Super-admin attribution view (D-007, AC-F06). Requires TAG_VIEW_ALL_ASSIGNMENTS permission.',
    tags: ['Tags', 'EntityAssignment'],
    requiredPermissions: [PermissionEnum.TAG_VIEW_ALL_ASSIGNMENTS],
    requestParams: {
        type: EntityTypeParamSchema,
        id: EntityIdSchema
    },
    responseSchema: EntityTagsAttributionResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const entityType = params.type as EntityTypeEnum;
        const entityId = params.id as string;

        apiLogger.debug(
            `[adminGetEntityTagAttribution] actor=${actor.id} entityType=${entityType} entityId=${entityId}`
        );

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

// ─── Router assembly ─────────────────────────────────────────────────────────

/**
 * Entity tag attribution router — super-admin attribution view
 * Mounted at /api/v1/admin/entities
 *
 * Route: GET /:type/:id/tags
 *
 * Per-actor own-assignment routes live in entities.ts (T-028).
 */
const entityAttributionApp = createRouter();
entityAttributionApp.route('/', adminGetEntityTagAttributionRoute);

export { entityAttributionApp as adminEntityTagAttributionRoutes };
