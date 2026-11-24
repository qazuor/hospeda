/**
 * Protected patch owner promotion endpoint
 * Requires authentication
 *
 * Owner decision 18 (Mi cuenta UI epic): a body that is exactly «pause this
 * promotion» (`{ lifecycleState }`, not ACTIVE) skips the `create_promotions`
 * gate, like the venue door (`isPauseBody`, HOS-2270 AC-6): an owner without
 * the plan key can still put a promotion away. Editing and re-activating keep
 * the gate.
 */

import {
    OwnerPromotionIdSchema,
    OwnerPromotionProtectedSchema,
    OwnerPromotionUpdateInputSchema,
    PermissionEnum,
    VerticalEnum
} from '@repo/schemas';
import { OwnerPromotionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';

import { getActorFromContext } from '../../../utils/actor';
import { enforceUserGate } from '../../../utils/listing-access/user-gate';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';
import { isPauseBody } from '../../venue/protected/promotion-access';
import { assertAccommodationPromotion } from './accommodation-door';

const ownerPromotionService = new OwnerPromotionService({ logger: apiLogger });

/**
 * PATCH /api/v1/protected/owner-promotions/:id
 * Partial update owner promotion - Protected endpoint
 */
export const protectedPatchOwnerPromotionRoute = createProtectedRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Patch owner promotion',
    description:
        'Partially updates an existing owner promotion. Requires OWNER_PROMOTION_UPDATE_OWN permission. Editing or re-activating needs create_promotions; a body that is only a non-ACTIVE lifecycleState pauses it without that key.',
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
        const existing = await ownerPromotionService.getById(actor, id);
        if (existing.error) {
            throw new ServiceError(existing.error.code, existing.error.message);
        }
        // HOS-2270: a venue promotion is not reachable through the accommodation door.
        assertAccommodationPromotion(existing.data);
        if (!isPauseBody({ body })) {
            await enforceUserGate({
                userId: actor.id,
                vertical: VerticalEnum.ACCOMMODATION,
                keys: ['create_promotions']
            });
        }
        // Strip ownerId from the patch body so a client cannot reassign ownership.
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
    options: {}
});
