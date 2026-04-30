/**
 * Admin INTERNAL tag impact count endpoint
 * Returns the count of r_entity_tag rows referencing a given INTERNAL tag
 *
 * Used as part of the two-step delete-confirmation UX (D-011):
 * 1. UI calls GET /api/v1/admin/tags/internal/:id/impact to get count.
 * 2. UI shows confirmation dialog with the count.
 * 3. On confirm, UI calls DELETE /api/v1/admin/tags/internal/:id.
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

/** Response schema for impact count */
const ImpactResponseSchema = z.object({
    count: z.number().int().nonnegative()
});

/**
 * GET /api/v1/admin/tags/internal/:id/impact
 * Get INTERNAL tag impact count — Admin endpoint
 *
 * Returns the number of entity assignments that reference this tag.
 * Requires TAG_INTERNAL_VIEW permission.
 */
export const adminGetInternalTagImpactRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/impact',
    summary: 'Get INTERNAL tag impact count',
    description:
        'Returns the count of entity assignments referencing this INTERNAL tag. Use before delete to show confirmation dialog (D-011). Requires TAG_INTERNAL_VIEW permission.',
    tags: ['Tags', 'Internal'],
    requiredPermissions: [PermissionEnum.TAG_INTERNAL_VIEW],
    requestParams: { id: TagIdSchema },
    responseSchema: ImpactResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        apiLogger.debug(`[adminGetInternalTagImpact] actor=${actor.id} tagId=${id}`);

        const result = await tagService.getImpactCount(actor, id);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
