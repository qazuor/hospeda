/**
 * Protected update owner promotion endpoint
 * Requires authentication
 */
import { EntitlementKey } from '@repo/billing';
import {
    OwnerPromotionIdSchema,
    OwnerPromotionProtectedSchema,
    OwnerPromotionUpdateInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { OwnerPromotionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { requireEntitlement } from '../../../middlewares/entitlement';
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
    description:
        'Updates an existing owner promotion. Requires OWNER_PROMOTION_UPDATE_OWN permission.',
    tags: ['Owner Promotions'],
    // Hosts hold the `_OWN` variant (mirrors get/list which use VIEW_OWN). The
    // generic OWNER_PROMOTION_UPDATE permission is not granted to any host role,
    // so requiring it here 403'd every owner edit. Ownership is enforced in the
    // service via checkCanUpdate (which also accepts UPDATE_ANY for admins).
    requiredPermissions: [PermissionEnum.OWNER_PROMOTION_UPDATE_OWN],
    requestParams: { id: OwnerPromotionIdSchema },
    requestBody: OwnerPromotionUpdateInputSchema,
    responseSchema: OwnerPromotionProtectedSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        // Strip ownerId from the update body so a client cannot reassign ownership.
        // The service layer does not guard against this field, so we drop it at the
        // route boundary before it reaches the service.
        const { ownerId: _drop, ...safeBody } = body as Record<string, unknown> & {
            ownerId?: unknown;
        };
        const result = await ownerPromotionService.update(actor, id, safeBody as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        // SPEC-145 T-005: CREATE_PROMOTIONS gate on full-replace mutation —
        // same plan requirement as create.
        middlewares: [requireEntitlement(EntitlementKey.CREATE_PROMOTIONS)]
    }
});
