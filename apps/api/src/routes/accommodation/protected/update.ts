/**
 * Protected update accommodation endpoint
 * Requires authentication and ownership
 */
import { EntitlementKey } from '@repo/billing';
import {
    AccommodationIdSchema,
    AccommodationProtectedSchema,
    AccommodationUpdateHttpSchema,
    PermissionEnum
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getQZPayBilling } from '../../../middlewares/billing';
import { requireEntitlement } from '../../../middlewares/entitlement';
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
 * PUT /api/v1/protected/accommodations/:id
 * Update accommodation - Protected endpoint with ownership check
 */
export const protectedUpdateAccommodationRoute = createProtectedRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update accommodation',
    description:
        'Updates an existing accommodation. Requires ownership or ACCOMMODATION_UPDATE_ANY permission.',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    requestBody: AccommodationUpdateHttpSchema,
    responseSchema: AccommodationProtectedSchema,
    ownership: {
        entityType: 'accommodation',
        ownershipFields: ['ownerId', 'createdById'],
        bypassPermission: PermissionEnum.ACCOMMODATION_UPDATE_ANY
    },
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const result = await accommodationService.update(actor, params.id as string, body);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        // SPEC-145 T-004: full-replace mutation requires EDIT_ACCOMMODATION_INFO
        // (granted on all owner/complex plans). Runs before the handler.
        middlewares: [requireEntitlement(EntitlementKey.EDIT_ACCOMMODATION_INFO)]
    }
});
