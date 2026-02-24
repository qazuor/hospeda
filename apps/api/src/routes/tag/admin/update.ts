/**
 * Admin update tag endpoint
 * Allows admins to update any tag
 */
import {
    PermissionEnum,
    type ServiceErrorCode,
    TagIdSchema,
    TagSchema,
    type TagUpdateInput,
    TagUpdateInputSchema
} from '@repo/schemas';
import { ServiceError, TagService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { createAdminRoute } from '../../../utils/route-factory.js';

const tagService = new TagService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/tags/:id
 * Update tag - Admin endpoint
 */
export const adminUpdateTagRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update tag (admin)',
    description: 'Updates any tag. Admin only.',
    tags: ['Tags'],
    requiredPermissions: [PermissionEnum.TAG_UPDATE],
    requestParams: {
        id: TagIdSchema
    },
    requestBody: TagUpdateInputSchema,
    responseSchema: TagSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;
        const data = body as TagUpdateInput;

        const result = await tagService.update(actor, id as string, data);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});
