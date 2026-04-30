/**
 * Admin SYSTEM tag impact count endpoint
 * Returns the count of r_entity_tag rows referencing a given SYSTEM tag
 *
 * Used as part of the two-step delete-confirmation UX (D-011):
 * 1. UI calls GET /api/v1/admin/tags/system/:id/impact to get count.
 * 2. UI shows confirmation dialog with the count.
 * 3. On confirm, UI calls DELETE /api/v1/admin/tags/system/:id.
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
 * GET /api/v1/admin/tags/system/:id/impact
 * Get SYSTEM tag impact count — Admin endpoint
 *
 * Returns the number of entity assignments that reference this tag across ALL users.
 * (Each user-SYSTEM-tag assignment creates a separate row, so this is the total count.)
 * Requires TAG_SYSTEM_VIEW permission.
 */
export const adminGetSystemTagImpactRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/impact',
    summary: 'Get SYSTEM tag impact count',
    description:
        'Returns the total count of entity assignments referencing this SYSTEM tag across all users. Use before delete to show confirmation dialog (D-011). Requires TAG_SYSTEM_VIEW permission.',
    tags: ['Tags', 'System'],
    requiredPermissions: [PermissionEnum.TAG_SYSTEM_VIEW],
    requestParams: { id: TagIdSchema },
    responseSchema: ImpactResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        apiLogger.debug(`[adminGetSystemTagImpact] actor=${actor.id} tagId=${id}`);

        const result = await tagService.getImpactCount(actor, id);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
