/**
 * Protected patch accommodation endpoint
 * Requires authentication and ownership
 */
import {
    AccommodationIdSchema,
    AccommodationProtectedSchema,
    AccommodationUpdateHttpSchema,
    PermissionEnum
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { gateRichDescription } from '../../../middlewares/accommodation-entitlements';
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
 * PATCH /api/v1/protected/accommodations/:id
 * Partial update accommodation - Protected endpoint with ownership check
 */
export const protectedPatchAccommodationRoute = createProtectedRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Patch accommodation',
    description:
        'Partially updates an accommodation. Requires ownership or ACCOMMODATION_UPDATE_ANY permission.',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    requestBody: AccommodationUpdateHttpSchema.partial(),
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
        // Use update method for patch - service handles partial updates
        const result = await accommodationService.update(actor, params.id as string, body);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        // Reference wiring of the negative-entitlement gate pattern for
        // SPEC-143 finding #25. `gateRichDescription` returns 403
        // ENTITLEMENT_REQUIRED when the body's `description` contains
        // markdown syntax AND the actor lacks CAN_USE_RICH_DESCRIPTION.
        // Plain-text descriptions pass through regardless of plan.
        middlewares: [gateRichDescription()]
    }
});
