/**
 * Protected unpublish accommodation endpoint
 * Requires authentication and ownership
 */
import { AccommodationIdSchema, AccommodationProtectedSchema, PermissionEnum } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getQZPayBilling } from '../../../middlewares/billing';
import { buildAccommodationPublishDeps } from '../../../services/accommodation-publish-deps';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService(
    { logger: apiLogger },
    undefined,
    null,
    undefined,
    buildAccommodationPublishDeps(getQZPayBilling)
);

/**
 * POST /api/v1/protected/accommodations/:id/unpublish
 * Unpublish accommodation - Transitions ACTIVE → INACTIVE.
 * Protected endpoint with ownership check. No entitlement gate — unpublish
 * is a basic lifecycle action available to all plan tiers.
 */
export const protectedUnpublishAccommodationRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/unpublish',
    summary: 'Unpublish accommodation',
    description:
        'Transitions an accommodation from ACTIVE to INACTIVE. Requires ownership or ACCOMMODATION_UPDATE_ANY permission.',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: AccommodationProtectedSchema,
    ownership: {
        entityType: 'accommodation',
        ownershipFields: ['ownerId', 'createdById'],
        bypassPermission: PermissionEnum.ACCOMMODATION_UPDATE_ANY
    },
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await accommodationService.unpublish(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
