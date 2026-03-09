/**
 * Admin get attraction by ID endpoint
 * Returns full attraction information including admin fields
 */
import { AttractionAdminSchema, AttractionIdSchema, PermissionEnum } from '@repo/schemas';
import { AttractionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const attractionService = new AttractionService({ logger: apiLogger });

/**
 * GET /api/v1/admin/attractions/:id
 * Get attraction by ID - Admin endpoint
 */
export const adminGetAttractionByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get attraction by ID (admin)',
    description: 'Retrieves full attraction information including admin fields',
    tags: ['Attractions'],
    requiredPermissions: [PermissionEnum.ATTRACTION_VIEW],
    requestParams: {
        id: AttractionIdSchema
    },
    responseSchema: AttractionAdminSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await attractionService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: { cacheTTL: 60, customRateLimit: { requests: 100, windowMs: 60000 } }
});
