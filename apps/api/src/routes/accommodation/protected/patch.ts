/**
 * Protected patch accommodation endpoint
 * Requires authentication and ownership
 */

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

import { getActorFromContext } from '../../../utils/actor';
import { stripRichDescriptionFields } from '../../../utils/entitlement-filter';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

// The publish-deps (trial eligibility + local trial) went down with the legacy
// billing system (HOS-1416); `publishDeps` is optional in `AccommodationService`.
const accommodationService = new AccommodationService({ logger: apiLogger });

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
    // HOS-1352: transitional until V3 (HOS-1357), see PR — removed EDIT_ACCOMMODATION_INFO entitlement gate.
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
        // Same treatment for the dedicated `videos` column: `gateVideoEmbed`
        // stashes an empty array when a non-entitled actor submits videos, and it
        // is applied here rather than rejecting the whole PATCH.
        const videosOverride = ctx.get('accommodationVideosOverride');
        const effectiveBody = {
            ...body,
            ...(descriptionOverride === undefined ? {} : { description: descriptionOverride }),
            ...(videosOverride === undefined ? {} : { videos: videosOverride })
        };

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

        // BETA-199: `AccommodationProtectedSchema` declares the premium
        // rich-description pair so the owner's editor GET can show translation
        // status for it. That GET gates the pair on the owner's plan; EVERY other
        // route on this schema — including this one — drops it unconditionally.
        // This response echoes a mutated entity and has no use for rich text, so
        // an unconditional drop keeps the payload identical to what it was before
        // the pair was declared, with no entitlement lookup and no gate to
        // get wrong. See the schema comment for the full contract.
        return stripRichDescriptionFields(result.data);
    },
    options: {
        // HOS-1352: transitional until V3 (HOS-1357), see PR — former plan gate removed; route permissions remain.
    }
});
