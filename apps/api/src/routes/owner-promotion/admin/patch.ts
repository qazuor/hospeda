/**
 * Admin patch owner promotion endpoint
 * Allows admins to partially update any owner promotion
 * NOTE: OwnerPromotion has no PatchInputSchema. Uses OwnerPromotionUpdateInputSchema (already partial).
 */
import {
    OwnerPromotionIdSchema,
    OwnerPromotionSchema,
    OwnerPromotionUpdateInputSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { OwnerPromotionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { transformApiInputToDomain } from '../../../utils/openapi-schema';
import { createAdminRoute } from '../../../utils/route-factory';

const ownerPromotionService = new OwnerPromotionService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/owner-promotions/:id
 * Partial update owner promotion - Admin endpoint
 */
export const adminPatchOwnerPromotionRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update owner promotion (admin)',
    description: 'Updates specific fields of any owner promotion. Admin only.',
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
        const domainInput = transformApiInputToDomain(body);
        const result = await ownerPromotionService.update(actor, id, domainInput as never);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    },
    options: { customRateLimit: { requests: 20, windowMs: 60000 } }
});
