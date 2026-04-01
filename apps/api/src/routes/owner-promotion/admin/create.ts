/**
 * Admin create owner promotion endpoint
 * Allows admins to create new owner promotions
 */
import {
    OwnerPromotionAdminSchema,
    type OwnerPromotionCreateInput,
    OwnerPromotionCreateInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { OwnerPromotionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const ownerPromotionService = new OwnerPromotionService({ logger: apiLogger });

/**
 * POST /api/v1/admin/owner-promotions
 * Create owner promotion - Admin endpoint
 */
export const adminCreateOwnerPromotionRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create owner promotion',
    description: 'Creates a new owner promotion. Admin only.',
    tags: ['Owner Promotions'],
    requiredPermissions: [PermissionEnum.OWNER_PROMOTION_CREATE],
    requestBody: OwnerPromotionCreateInputSchema,
    responseSchema: OwnerPromotionAdminSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const data = body as OwnerPromotionCreateInput;
        const result = await ownerPromotionService.create(actor, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
