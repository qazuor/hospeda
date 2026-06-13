/**
 * Protected get own owner-promotion by ID endpoint
 * Returns a single promotion by ID, accessible only by the owning actor.
 *
 * Security model:
 * - 404 if the promotion does not exist.
 * - 403 if the promotion exists but belongs to a different user (enforced by
 *   `OwnerPromotionService._canView` → `checkCanView` → `checkGenericPermission`
 *   with OWNER_PROMOTION_VIEW_ANY / OWNER_PROMOTION_VIEW_OWN + ownership check).
 * - All lifecycle states are visible to the owner (no ACTIVE-only gate).
 */
import {
    OwnerPromotionIdSchema,
    OwnerPromotionProtectedSchema,
    PermissionEnum
} from '@repo/schemas';
import { OwnerPromotionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const ownerPromotionService = new OwnerPromotionService({ logger: apiLogger });

/**
 * GET /api/v1/protected/owner-promotions/:id
 * Get own owner-promotion by ID - Protected endpoint
 *
 * Returns a single promotion regardless of its lifecycle state.
 * If the promotion exists but belongs to another owner, 403 is returned.
 * If the promotion is not found, 404 is returned.
 */
export const protectedGetOwnerPromotionByIdRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get own owner-promotion by ID',
    description:
        'Returns a single owner promotion by ID. Only the owning user may access it. Returns 404 if not found, 403 if the promotion belongs to another user. Requires OWNER_PROMOTION_VIEW_OWN or OWNER_PROMOTION_VIEW_ANY permission.',
    tags: ['Owner Promotions'],
    requiredPermissions: [PermissionEnum.OWNER_PROMOTION_VIEW_OWN],
    requestParams: { id: OwnerPromotionIdSchema },
    responseSchema: OwnerPromotionProtectedSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        // getById delegates to _canView which calls checkCanView.
        // checkCanView uses checkGenericPermission:
        //   - OWNER_PROMOTION_VIEW_ANY: staff/admin bypass, no ownership check.
        //   - OWNER_PROMOTION_VIEW_OWN: only if actor.id === entity.ownerId.
        // ServiceErrorCode.NOT_FOUND → 404; ServiceErrorCode.FORBIDDEN → 403
        // (both propagated via the shared handleRouteError in the factory).
        const result = await ownerPromotionService.getById(actor, id);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
