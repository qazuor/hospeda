/**
 * POST /api/v1/protected/accommodations/:id/media/featured
 * HOS-1352: transitional until V3 (HOS-1357), see PR — the former plan gate or limit is removed.
 */

import {
    AccommodationFeaturedMediaAddOutputSchema,
    AccommodationIdSchema,
    type AccommodationMediaAddPayload,
    AccommodationMediaAddPayloadSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * POST /api/v1/protected/accommodations/:id/media/featured
 * Upload straight to cover — Protected endpoint.
 *
 * Permission model: the service layer `accommodationService.addFeaturedMedia`
 * calls `_canUpdate(actor, accommodation)`, enforcing
 * `ACCOMMODATION_UPDATE_ANY` OR (`ACCOMMODATION_UPDATE_OWN` + ownership) — the
 * same gate `addMedia` uses. A non-owner therefore gets the same answer here as
 * anywhere else in the media family, and never a different one that would
 * confirm the accommodation exists.
 *
 * Route requires the `EDIT_ACCOMMODATION_INFO` entitlement, matching every other
 * gallery mutation.
 */
export const protectedAddFeaturedMediaRoute = createCRUDRoute({
    method: 'post',
    path: '/{id}/media/featured',
    summary: 'Upload the accommodation cover image (owner)',
    description:
        'Register an already-uploaded URL as the accommodation cover. The row is ' +
        'created already featured and the photo it replaces is DELETED in the same ' +
        'transaction — soft-deleted, so it disappears from the listing while its ' +
        'stored file is kept. Unlike POST /:id/media this ' +
        'does not consume a plan photo slot, because the cover is not a gallery ' +
        'item (HOS-791). Requires ' +
        'EDIT_ACCOMMODATION_INFO; the service layer enforces UPDATE_OWN + ownership.',
    tags: ['Accommodations', 'Media'],
    requestParams: {
        id: AccommodationIdSchema
    },
    // The SAME payload the gallery endpoint accepts. A cover differs in what the
    // server does with it, not in what the caller sends — which is precisely why
    // neither `isFeatured` nor any cap is reachable from this body.
    requestBody: AccommodationMediaAddPayloadSchema,
    responseSchema: AccommodationFeaturedMediaAddOutputSchema,
    // HOS-1352: transitional until V3 (HOS-1357), see PR — removed EDIT_ACCOMMODATION_INFO entitlement gate.
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;

        // The per-plan gallery cap (MAX_PHOTOS_PER_ACCOMMODATION) was removed
        // with the legacy billing system (HOS-1416); `planGalleryCap` stays
        // unset so only the service's own per-entity cap applies.
        const result = await accommodationService.addFeaturedMedia(actor, {
            accommodationId,
            media: body as AccommodationMediaAddPayload
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        if (!result.data) {
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Failed to register the cover image'
            );
        }

        return result.data;
    },
    options: {
        // HOS-1352: transitional until V3 (HOS-1357), see PR — former plan gate removed; route permissions remain.
    }
});
