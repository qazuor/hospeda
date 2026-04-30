/**
 * Admin own USER tag impact count endpoint
 * Returns the count of the calling actor's own assignments for a USER tag
 *
 * This returns only the ACTOR'S OWN assignment count (not global count) per D-007.
 * Used for the user tag manager's delete confirmation flow (AC-003-02).
 *
 * Distinct from the global getImpactCount() used by INTERNAL/SYSTEM endpoints.
 *
 * @see SPEC-086 D-007, D-011, D-017, AC-003-02
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

/** Response schema for own impact count */
const OwnImpactResponseSchema = z.object({
    count: z.number().int().nonnegative()
});

/**
 * GET /api/v1/admin/tags/own/:id/impact
 * Get own USER tag impact count — Admin endpoint
 *
 * Returns the count of the calling actor's OWN assignments referencing this tag.
 * This is actor-scoped (not total global count) per D-007.
 * Service enforces ownership — returns 403 if tag does not belong to actor.
 * Requires TAG_USER_VIEW_OWN permission.
 */
export const adminGetOwnTagImpactRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/impact',
    summary: 'Get own USER tag impact count',
    description:
        "Returns the count of the calling actor's own assignments referencing this USER tag. Actor-scoped per D-007 (not global count). Use before delete to show confirmation. Requires TAG_USER_VIEW_OWN permission.",
    tags: ['Tags', 'OwnTags'],
    requiredPermissions: [PermissionEnum.TAG_USER_VIEW_OWN],
    requestParams: { id: TagIdSchema },
    responseSchema: OwnImpactResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        apiLogger.debug(`[adminGetOwnTagImpact] actor=${actor.id} tagId=${id}`);

        // getOwnTagImpactCount counts only actor's own assignments (D-007)
        const result = await tagService.getOwnTagImpactCount(id, actor);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
