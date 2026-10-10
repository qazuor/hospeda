/**
 * POST /api/v1/admin/accommodations/:id/media
 * Add a photo to an accommodation gallery - Admin endpoint (SPEC-204)
 *
 * This is a URL-receiver endpoint: the caller has already uploaded the file to
 * Cloudinary via `POST /api/v1/admin/media/upload`. This endpoint registers the
 * returned URL + metadata as a new `accommodation_media` row.
 *
 * Gallery registration enforces the owner's effective photo cap.
 * The listing access resolver enforces the owner photo limit.
 */

import {
    AccommodationIdSchema,
    type AccommodationMediaAddInput,
    type AccommodationMediaAddPayload,
    AccommodationMediaAddPayloadSchema,
    AccommodationMediaSingleOutputSchema,
    ServiceErrorCode,
    VerticalEnum
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';

import { getActorFromContext } from '../../../utils/actor';
import { accommodationGalleryPhotoLimit } from '../../../utils/listing-access/photo-limit';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * POST /api/v1/admin/accommodations/:id/media
 * Add a photo to an accommodation gallery - Admin endpoint
 *
 * Permission model (SPEC-204): service layer `accommodationService.addMedia`
 * calls `_canUpdate(actor, accommodation)` which enforces
 * `ACCOMMODATION_UPDATE_ANY` OR (`ACCOMMODATION_UPDATE_OWN` + ownership).
 * Route only requires admin-panel access so HOSTs can manage photos on their
 * own accommodations.
 *
 * Plan cap: enforced here (not in the service) because `checkLimit` needs the
 * Hono Context. Mirrors the cap logic in `apps/api/src/routes/media/admin/upload.ts`
 * §3d-i exactly and applies to the listing owner for every actor.
 */
export const adminAddMediaRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/media',
    summary: 'Add photo to accommodation gallery (admin)',
    description:
        'Register an already-uploaded URL as a new accommodation_media row. ' +
        'Requires admin-panel access; the service layer enforces UPDATE_ANY or ' +
        '(UPDATE_OWN + ownership). Plan photo cap is enforced for owner-actors.',
    tags: ['Accommodations', 'Media'],
    requestParams: {
        id: AccommodationIdSchema
    },
    requestBody: AccommodationMediaAddPayloadSchema,
    responseSchema: AccommodationMediaSingleOutputSchema,
    listingAccess: {
        vertical: VerticalEnum.ACCOMMODATION,
        operation: 'EDIT',
        idParam: 'id',
        limit: accommodationGalleryPhotoLimit
    },
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;

        // Listing access already checked the owner's visible gallery limit.
        const accommodation = await accommodationService.getById(actor, accommodationId);
        if (accommodation.error || !accommodation.data) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
        }

        // ── Delegate to service ───────────────────────────────────────────────
        const input: AccommodationMediaAddInput = {
            accommodationId,
            media: body as AccommodationMediaAddPayload
        };

        const result = await accommodationService.addMedia(actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
