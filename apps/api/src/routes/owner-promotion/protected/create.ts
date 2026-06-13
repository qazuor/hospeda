/**
 * Protected create owner promotion endpoint
 * Requires authentication
 */
import { EntitlementKey } from '@repo/billing';
import {
    OwnerPromotionCreateRequestSchema,
    OwnerPromotionProtectedSchema,
    PermissionEnum
} from '@repo/schemas';
import { OwnerPromotionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { requireEntitlement } from '../../../middlewares/entitlement';
import { enforcePromotionLimit } from '../../../middlewares/limit-enforcement';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const ownerPromotionService = new OwnerPromotionService({ logger: apiLogger });

/**
 * POST /api/v1/protected/owner-promotions
 * Create owner promotion - Protected endpoint
 */
export const protectedCreateOwnerPromotionRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    summary: 'Create owner promotion',
    description: 'Creates a new owner promotion. Requires OWNER_PROMOTION_CREATE permission.',
    tags: ['Owner Promotions'],
    requiredPermissions: [PermissionEnum.OWNER_PROMOTION_CREATE],
    requestBody: OwnerPromotionCreateRequestSchema,
    responseSchema: OwnerPromotionProtectedSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        // Inject ownerId from the authenticated session actor so the client
        // cannot supply or forge it. The body is validated against
        // OwnerPromotionCreateRequestSchema which omits ownerId entirely.
        const result = await ownerPromotionService.create(actor, {
            ...body,
            ownerId: actor.id
        } as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        // SPEC-145 T-005: entitlement gate BEFORE limit check — actor must have the
        // CREATE_PROMOTIONS entitlement (granted on owner-pro, owner-premium,
        // complex-pro, complex-premium) before we consult the promotion-count limit.
        middlewares: [requireEntitlement(EntitlementKey.CREATE_PROMOTIONS), enforcePromotionLimit()]
    }
});
