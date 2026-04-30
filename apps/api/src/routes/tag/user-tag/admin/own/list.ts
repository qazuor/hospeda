/**
 * Admin own USER tag list endpoint
 * Returns the calling actor's own USER tags (all lifecycle states)
 *
 * Shows ACTIVE, INACTIVE, and ARCHIVED tags for the actor's manager UI (D-022).
 * Supports optional name search and lifecycle state filter.
 *
 * @see SPEC-086 D-007, D-017, D-022, AC-003-01, AC-003-04
 */
import { PermissionEnum, TagSchema } from '@repo/schemas';
import { LifecycleStatusEnum } from '@repo/schemas';
import { ServiceError, TagService } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../../../../utils/actor';
import { apiLogger } from '../../../../../utils/logger';
import { createAdminRoute } from '../../../../../utils/route-factory';

const tagService = new TagService({ logger: apiLogger });

/** Query schema for listOwnTags — search and lifecycle filter */
const ListOwnTagsQuerySchema = z.object({
    search: z.string().optional(),
    lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional()
});

/** Response schema for own tags list */
const ListOwnTagsResponseSchema = z.object({
    tags: z.array(TagSchema)
});

/**
 * GET /api/v1/admin/tags/own
 * List actor's own USER tags — Admin endpoint
 *
 * Returns all USER tags owned by the calling actor across all lifecycle states.
 * Supports optional search (substring on name, D-014) and lifecycle state filter.
 * Requires TAG_USER_VIEW_OWN permission.
 */
export const adminListOwnTagsRoute = createAdminRoute({
    method: 'get',
    path: '/',
    summary: 'List own USER tags',
    description:
        'Returns all USER tags owned by the calling actor (ACTIVE, INACTIVE, ARCHIVED). Supports optional name search (D-014) and lifecycle state filter. Requires TAG_USER_VIEW_OWN permission.',
    tags: ['Tags', 'OwnTags'],
    requiredPermissions: [PermissionEnum.TAG_USER_VIEW_OWN],
    requestQuery: ListOwnTagsQuerySchema.shape,
    responseSchema: ListOwnTagsResponseSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const q = query as z.infer<typeof ListOwnTagsQuerySchema> | undefined;

        const result = await tagService.listOwnTags(actor, q ?? {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data ?? { tags: [] };
    }
});
