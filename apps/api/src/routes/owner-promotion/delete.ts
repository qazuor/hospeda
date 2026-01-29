/**
 * Protected soft delete owner promotion endpoint
 * Requires authentication
 */
import {
    OwnerPromotionIdSchema,
    PermissionEnum,
    type ServiceErrorCode,
    SuccessSchema
} from '@repo/schemas';
import { OwnerPromotionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createProtectedRoute } from '../../utils/route-factory';

const ownerPromotionService = new OwnerPromotionService({ logger: apiLogger });

/**
 * DELETE /api/v1/public/owner-promotions/:id
 * Soft delete owner promotion - Protected endpoint
 */
export const deleteOwnerPromotionRoute = createProtectedRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete owner promotion',
    description: 'Soft deletes an owner promotion. Requires OWNER_PROMOTION_DELETE permission.',
    tags: ['Owner Promotions'],
    requiredPermissions: [PermissionEnum.OWNER_PROMOTION_DELETE],
    requestParams: { id: OwnerPromotionIdSchema },
    responseSchema: SuccessSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await ownerPromotionService.softDelete(actor, id);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});
