/**
 * POST /api/v1/admin/accommodations/:id/media/featured
 * Register an already-uploaded URL as the accommodation's COVER — Admin
 * endpoint (HOS-803).
 *
 * The admin mirror of `routes/accommodation/protected/addFeaturedMedia.ts`, and
 * the one the admin panel's gallery manager actually calls — its hooks address
 * `/api/v1/admin/...`, never the protected tier.
 *
 * ## Why this exists next to `POST /:id/media`
 *
 * Setting a cover used to be two requests: register an ordinary gallery row,
 * then promote it. During the billing transition, a cover can be registered
 * directly without a gallery photo cap.
 *
 * The swap cannot move the gallery: the replaced cover is DELETED
 * (soft-deleted) in the same transaction, so one row enters the featured slot
 * and one leaves the table.
 *
 * The replaced photo is NOT kept. It does not fall back into the gallery; it
 * disappears from the listing. Its stored file is deliberately left in place, so
 * the deletion is reversible at the row level, but callers must not present the
 * old cover as still available.
 *
 * HOS-1352: transitional until V3 (HOS-1357), see PR — the former plan gate or limit is removed.
 */

import {
    AccommodationFeaturedMediaAddOutputSchema,
    AccommodationIdSchema,
    type AccommodationMediaAddPayload,
    AccommodationMediaAddPayloadSchema,
    ServiceErrorCode,
    VerticalEnum
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * POST /api/v1/admin/accommodations/:id/media/featured
 * Upload straight to cover — Admin endpoint.
 *
 * Permission model: the service layer `accommodationService.addFeaturedMedia`
 * calls `_canUpdate(actor, accommodation)`, enforcing
 * `ACCOMMODATION_UPDATE_ANY` OR (`ACCOMMODATION_UPDATE_OWN` + ownership). The
 * route only requires admin-panel access, so HOSTs can manage the cover of
 * their own accommodations here — which is why the owner check below is a real
 * branch and not dead code.
 */
export const adminAddFeaturedMediaRoute = createAdminRoute({
    method: 'post',
    listingAccess: { vertical: VerticalEnum.ACCOMMODATION, operation: 'EDIT', idParam: 'id' },
    path: '/{id}/media/featured',
    summary: 'Upload the accommodation cover image (admin)',
    description:
        'Register an already-uploaded URL as the accommodation cover. The row is ' +
        'created already featured and the photo it replaces is DELETED in the same ' +
        'transaction — soft-deleted, so it disappears from the listing while its ' +
        'stored file is kept. Unlike POST /:id/media this ' +
        'does not consume a plan photo slot, because the cover is not a gallery ' +
        'item (HOS-791). Requires ' +
        'admin-panel access; the service enforces UPDATE_ANY or (UPDATE_OWN + ownership).',
    tags: ['Accommodations', 'Media'],
    requestParams: {
        id: AccommodationIdSchema
    },
    // The SAME payload the gallery endpoint accepts. A cover differs in what the
    // server does with it, not in what the caller sends — which is why neither
    // `isFeatured` nor the cap is reachable from this body.
    requestBody: AccommodationMediaAddPayloadSchema,
    responseSchema: AccommodationFeaturedMediaAddOutputSchema,
    // HOS-1352: transitional until V3 (HOS-1357), see PR — removed MAX_PHOTOS_PER_ACCOMMODATION plan limit.
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;

        // Owner-only, mirroring addMedia: staff acting on someone else's listing
        // are not spending that host's plan. `undefined` means "no plan cap",
        // leaving only the per-entity cap the service applies itself.
        const accommodation = await accommodationService.getById(actor, accommodationId);
        if (accommodation.error || !accommodation.data) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
        }

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
    }
});
