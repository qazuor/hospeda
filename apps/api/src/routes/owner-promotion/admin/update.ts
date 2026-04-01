/**
 * Admin update owner promotion endpoint
 * Allows admins to update any owner promotion
 */
import {
    OwnerPromotionAdminSchema,
    OwnerPromotionIdSchema,
    OwnerPromotionUpdateInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { OwnerPromotionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const ownerPromotionService = new OwnerPromotionService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/owner-promotions/:id
 * Update owner promotion - Admin endpoint
 */
export const adminUpdateOwnerPromotionRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update owner promotion (admin)',
    description: 'Updates any owner promotion. Admin only.',
    tags: ['Owner Promotions'],
    requiredPermissions: [PermissionEnum.OWNER_PROMOTION_UPDATE],
    requestParams: {
        id: OwnerPromotionIdSchema
    },
    requestBody: OwnerPromotionUpdateInputSchema,
    responseSchema: OwnerPromotionAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;
        const result = await ownerPromotionService.update(actor, id as string, body as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
