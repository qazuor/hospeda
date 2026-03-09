/**
 * Protected update owner promotion endpoint
 * Requires authentication
 */
import {
    OwnerPromotionIdSchema,
    OwnerPromotionSchema,
    OwnerPromotionUpdateInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { OwnerPromotionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const ownerPromotionService = new OwnerPromotionService({ logger: apiLogger });

/**
 * PUT /api/v1/protected/owner-promotions/:id
 * Update owner promotion - Protected endpoint
 */
export const protectedUpdateOwnerPromotionRoute = createProtectedRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update owner promotion',
    description: 'Updates an existing owner promotion. Requires OWNER_PROMOTION_UPDATE permission.',
    tags: ['Owner Promotions'],
    requiredPermissions: [PermissionEnum.OWNER_PROMOTION_UPDATE],
    requestParams: { id: OwnerPromotionIdSchema },
    requestBody: OwnerPromotionUpdateInputSchema,
    responseSchema: OwnerPromotionSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await ownerPromotionService.update(actor, id, body as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
