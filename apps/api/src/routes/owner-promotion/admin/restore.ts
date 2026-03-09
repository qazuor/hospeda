/**
 * Admin restore owner promotion endpoint
 * Restores a soft-deleted owner promotion
 */
import { OwnerPromotionIdSchema, OwnerPromotionSchema, PermissionEnum } from '@repo/schemas';
import { OwnerPromotionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const ownerPromotionService = new OwnerPromotionService({ logger: apiLogger });

/**
 * POST /api/v1/admin/owner-promotions/:id/restore
 * Restore owner promotion - Admin endpoint
 */
export const adminRestoreOwnerPromotionRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore owner promotion',
    description:
        'Restores a soft-deleted owner promotion. Requires OWNER_PROMOTION_RESTORE permission.',
    tags: ['Owner Promotions'],
    requiredPermissions: [PermissionEnum.OWNER_PROMOTION_RESTORE],
    requestParams: {
        id: OwnerPromotionIdSchema
    },
    responseSchema: OwnerPromotionSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await ownerPromotionService.restore(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
