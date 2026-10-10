/**
 * Protected update accommodation endpoint
 * Requires authentication and ownership
 */

import {
    AccommodationIdSchema,
    AccommodationProtectedSchema,
    type AccommodationUpdateHttp,
    AccommodationUpdateHttpSchema,
    type AccommodationUpdateInput,
    httpToDomainAccommodationUpdate,
    PermissionEnum,
    VerticalEnum
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
    listingAccess: { vertical: VerticalEnum.ACCOMMODATION, operation: 'EDIT', idParam: 'id' },
    ownership: {
        entityType: 'accommodation',
        ownershipFields: ['ownerId', 'createdById'],
        bypassPermission: PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT
    },
    // HOS-1352: transitional until V3 (HOS-1357), see PR — removed EDIT_ACCOMMODATION_INFO entitlement gate.
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        // Convert the flat HTTP body to domain-shaped input before calling the
        // service, exactly as the PATCH on this resource does. This route used
        // to forward the raw body, and `AccommodationUpdateInputSchema` is NOT
        // `.strict()`, so every flat key the domain does not know — `latitude`,
        // `basePrice`, `phone`, the socials, `maxGuests`, `media` — was dropped
        // by Zod and the response was still a 200. Only the handful of fields
        // that happen to share a name on both sides (`name`, `summary`,
        // `description`, `type`, `destinationId`, `amenityIds`, `featureIds`)
        // ever persisted (HOS-573).
        const domainInput: AccommodationUpdateInput = httpToDomainAccommodationUpdate(
            body as AccommodationUpdateHttp
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
