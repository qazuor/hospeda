/**
 * Admin hard delete owner promotion endpoint
 * Permanently deletes an owner promotion
 */
import { OwnerPromotionIdSchema, PermissionEnum } from '@repo/schemas';
import { OwnerPromotionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const ownerPromotionService = new OwnerPromotionService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/owner-promotions/:id/hard
 * Hard delete owner promotion - Admin endpoint
 */
export const adminHardDeleteOwnerPromotionRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/hard',
    summary: 'Hard delete owner promotion',
    description:
        'Permanently deletes an owner promotion. Requires OWNER_PROMOTION_HARD_DELETE permission.',
    tags: ['Owner Promotions'],
    requiredPermissions: [PermissionEnum.OWNER_PROMOTION_HARD_DELETE],
    requestParams: {
        id: OwnerPromotionIdSchema
    },
    responseSchema: z.object({
        success: z.boolean(),
        message: z.string()
    }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await ownerPromotionService.hardDelete(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            success: true,
            message: 'Owner promotion permanently deleted'
        };
    }
});
