/**
 * Protected create owner promotion endpoint
 * Requires authentication
 */
import {
    OwnerPromotionCreateInputSchema,
    OwnerPromotionSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { OwnerPromotionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { enforcePromotionLimit } from '../../middlewares/limit-enforcement';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createProtectedRoute } from '../../utils/route-factory';

const ownerPromotionService = new OwnerPromotionService({ logger: apiLogger });

/**
 * POST /api/v1/public/owner-promotions
 * Create owner promotion - Protected endpoint
 */
export const createOwnerPromotionRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    summary: 'Create owner promotion',
    description: 'Creates a new owner promotion. Requires OWNER_PROMOTION_CREATE permission.',
    tags: ['Owner Promotions'],
    requiredPermissions: [PermissionEnum.OWNER_PROMOTION_CREATE],
    requestBody: OwnerPromotionCreateInputSchema,
    responseSchema: OwnerPromotionSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const result = await ownerPromotionService.create(actor, body as never);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    },
    options: {
        middlewares: [enforcePromotionLimit()] // Check promotion limit before creation
    }
});
