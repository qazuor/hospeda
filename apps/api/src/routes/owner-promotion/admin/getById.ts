/**
 * Admin get owner promotion by ID endpoint
 * Returns full owner promotion information including admin fields
 */
import { OwnerPromotionIdSchema, OwnerPromotionSchema, PermissionEnum } from '@repo/schemas';
import { OwnerPromotionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const ownerPromotionService = new OwnerPromotionService({ logger: apiLogger });

/**
 * GET /api/v1/admin/owner-promotions/:id
 * Get owner promotion by ID - Admin endpoint
 */
export const adminGetOwnerPromotionByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get owner promotion by ID (admin)',
    description: 'Retrieves full owner promotion information including admin fields',
    tags: ['Owner Promotions'],
    requiredPermissions: [PermissionEnum.OWNER_PROMOTION_VIEW],
    requestParams: {
        id: OwnerPromotionIdSchema
    },
    responseSchema: OwnerPromotionSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await ownerPromotionService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
