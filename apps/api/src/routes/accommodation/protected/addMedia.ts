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
import { createProtectedRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * POST /api/v1/protected/accommodations/:id/media
 * Add a photo to an accommodation gallery — Protected endpoint
 *
 * Permission model (SPEC-204): service layer `accommodationService.addMedia`
 * calls `_canUpdate(actor, accommodation)` which enforces
 * `ACCOMMODATION_UPDATE_ANY` OR (`ACCOMMODATION_UPDATE_OWN` + ownership).
 * Route requires `EDIT_ACCOMMODATION_INFO` entitlement (granted on all host plans)
 * plus the owner gallery photo limit in listing access.
 */
export const protectedAddMediaRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/media',
    summary: 'Add photo to accommodation gallery (owner)',
    description:
        'Register an already-uploaded URL as a new accommodation_media row. ' +
        'Requires EDIT_ACCOMMODATION_INFO entitlement. Plan photo cap is enforced ' +
        'on the owner. The service layer enforces UPDATE_OWN + ownership.',
    listingAccess: {
        vertical: VerticalEnum.ACCOMMODATION,
        operation: 'EDIT',
        idParam: 'id',
        limit: accommodationGalleryPhotoLimit
    },
    tags: ['Accommodations', 'Media'],
    protectedTag: false,
    requestParams: {
        id: AccommodationIdSchema
    },
    requestBody: AccommodationMediaAddPayloadSchema,
    responseSchema: AccommodationMediaSingleOutputSchema,
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
