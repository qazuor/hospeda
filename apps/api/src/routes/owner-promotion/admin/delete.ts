/**
 * Admin soft delete owner promotion endpoint
 * Allows admins to soft delete any owner promotion
 */
import {
    DeleteResultSchema,
    OwnerPromotionIdSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { OwnerPromotionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const ownerPromotionService = new OwnerPromotionService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/owner-promotions/:id
 * Soft delete owner promotion - Admin endpoint
 */
export const adminDeleteOwnerPromotionRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete owner promotion (admin)',
    description: 'Soft deletes an owner promotion. Admin only.',
    tags: ['Owner Promotions'],
    requiredPermissions: [PermissionEnum.OWNER_PROMOTION_DELETE],
    requestParams: {
        id: OwnerPromotionIdSchema
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;
        const result = await ownerPromotionService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            deleted: result.data?.count > 0,
            id
        };
    }
});
