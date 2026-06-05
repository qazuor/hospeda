/**
 * Protected patch accommodation endpoint
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
import {
    gateRichDescription,
    gateVideoEmbed
} from '../../../middlewares/accommodation-entitlements';
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
        // Negative-entitlement gates for SPEC-143 finding #25 (in order of
        // execution). Each gate inspects the request body for content that
        // exercises a gated capability and throws 403 ENTITLEMENT_REQUIRED
        // if the actor's plan does not include the corresponding entitlement.
        // Plain-text descriptions / non-gated payloads pass through.
        //
        // - requireEntitlement(EDIT_ACCOMMODATION_INFO): baseline gate — actor
        //   must be on any owner/complex plan (granted on all host tiers).
        //   Runs first so non-entitled users get a clean 403 before body
        //   inspection by the content-specific gates.
        // - gateRichDescription: blocks markdown syntax in `description` when
        //   actor lacks CAN_USE_RICH_DESCRIPTION (owner-basico, free tiers).
        // - gateVideoEmbed: blocks video URLs (YouTube/Vimeo/Dailymotion) in
        //   `description` when actor lacks CAN_EMBED_VIDEO (owner-basico).
        //
        // Both content gates use the same envelope shape (code: ENTITLEMENT_REQUIRED,
        // details: {requiredEntitlement, upgradeUrl}) so the frontend has
        // consistent handling for entitlement-driven 403s.
        middlewares: [
            requireEntitlement(EntitlementKey.EDIT_ACCOMMODATION_INFO),
            gateRichDescription(),
            gateVideoEmbed()
        ]
    }
});
