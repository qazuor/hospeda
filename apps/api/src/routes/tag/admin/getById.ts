/**
 * Admin get tag by ID endpoint
 * Returns full tag information including admin fields
 */
import { PermissionEnum, TagAdminSchema, TagIdSchema } from '@repo/schemas';
import { ServiceError, TagService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const tagService = new TagService({ logger: apiLogger });

/**
 * GET /api/v1/admin/tags/:id
 * Get tag by ID - Admin endpoint
 */
export const adminGetTagByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get tag by ID (admin)',
    description: 'Retrieves full tag information including admin fields',
    tags: ['Tags'],
    requiredPermissions: [PermissionEnum.TAG_UPDATE],
    requestParams: {
        id: TagIdSchema
    },
    responseSchema: TagAdminSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await tagService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: { cacheTTL: 60, customRateLimit: { requests: 100, windowMs: 60000 } }
});
