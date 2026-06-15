/**
 * Protected soft delete owner promotion endpoint
 * Requires authentication
 */
import { OwnerPromotionIdSchema, PermissionEnum, SuccessSchema } from '@repo/schemas';
import { OwnerPromotionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const ownerPromotionService = new OwnerPromotionService({ logger: apiLogger });

/**
 * DELETE /api/v1/protected/owner-promotions/:id
 * Soft delete owner promotion - Protected endpoint
 */
export const protectedDeleteOwnerPromotionRoute = createProtectedRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete owner promotion',
    description:
        'Soft deletes an owner promotion. Requires OWNER_PROMOTION_SOFT_DELETE_OWN permission.',
    tags: ['Owner Promotions'],
    // Hosts hold the `_OWN` variant (mirrors get/list which use VIEW_OWN). The
    // generic OWNER_PROMOTION_DELETE permission is not granted to any host role,
    // so requiring it here 403'd every owner delete. Ownership is enforced in the
    // service via checkCanSoftDelete (which also accepts SOFT_DELETE_ANY for admins).
    requiredPermissions: [PermissionEnum.OWNER_PROMOTION_SOFT_DELETE_OWN],
    requestParams: { id: OwnerPromotionIdSchema },
    responseSchema: SuccessSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await ownerPromotionService.softDelete(actor, id);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
