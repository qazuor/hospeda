/**
 * Protected patch accommodation endpoint
 * Requires authentication and ownership
 */
import { EntitlementKey } from '@repo/billing';
import type { AccommodationUpdateHttp, AccommodationUpdateInput } from '@repo/schemas';
import {
    AccommodationIdSchema,
    AccommodationProtectedSchema,
    AccommodationUpdateHttpSchema,
    httpToDomainAccommodationUpdate,
    PermissionEnum
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import {
    gateRichDescription,
    gateVideoEmbed
} from '../../../middlewares/accommodation-entitlements';
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
    buildAccommodationPublishDeps()
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

        // HOS-216: gateRichDescription / gateVideoEmbed no longer reject the
        // whole PATCH when the actor lacks the entitlement for content they
        // submitted — they neutralize just the gated syntax in `description`
        // and stash the sanitized value here instead. Apply it before
        // conversion so the rest of the body (name, price, capacity,
        // contact...) still persists unchanged. `undefined` means neither
        // gate touched the description (entitled actor, or plain text).
        const descriptionOverride = ctx.get('accommodationDescriptionOverride');
        const effectiveBody =
            descriptionOverride === undefined
                ? body
                : { ...body, description: descriptionOverride };

        // Convert flat HTTP body to domain-shaped input before calling the service.
        // Without this conversion, nested fields (location.coordinates, price.price,
        // contactInfo, socialNetworks, extraInfo, media) are never persisted (SPEC-208).
        const domainInput: AccommodationUpdateInput = httpToDomainAccommodationUpdate(
            effectiveBody as AccommodationUpdateHttp
        );
        const result = await accommodationService.update(actor, params.id as string, domainInput);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        // Negative-entitlement gates for SPEC-143 finding #25 (in order of
        // execution). Plain-text descriptions / non-gated payloads pass
        // through untouched.
        //
        // - requireEntitlement(EDIT_ACCOMMODATION_INFO): baseline gate — actor
        //   must be on any owner/complex plan (granted on all host tiers).
        //   Runs first so non-entitled users get a clean 403 before body
        //   inspection by the content-specific gates. Still throws 403 —
        //   HOS-216 does NOT touch this gate (see HOS-217).
        // - gateRichDescription: when actor lacks CAN_USE_RICH_DESCRIPTION
        //   (owner-basico, free tiers) and `description` contains markdown
        //   syntax, neutralizes just that syntax (HOS-216) instead of
        //   rejecting the request — see the handler below and the gate's own
        //   doc comment in `accommodation-entitlements.ts`.
        // - gateVideoEmbed: same neutralize-not-reject treatment (HOS-216)
        //   for video URLs (YouTube/Vimeo/Dailymotion) when actor lacks
        //   CAN_EMBED_VIDEO (owner-basico).
        //
        // The EDIT_ACCOMMODATION_INFO gate still uses the ENTITLEMENT_REQUIRED
        // envelope (code, details: {requiredEntitlement, upgradeUrl}) — the
        // two content gates no longer throw at all as of HOS-216.
        middlewares: [
            requireEntitlement(EntitlementKey.EDIT_ACCOMMODATION_INFO),
            gateRichDescription(),
            gateVideoEmbed()
        ]
    }
});
