/**
 * PATCH /api/v1/protected/accommodations/:id/media/:mediaId
 * Correct the text metadata of an accommodation gallery photo — Protected
 * (owner-facing) endpoint (HOS-388)
 *
 * Before this endpoint the only way to fix a typo in an `alt` text was to
 * delete the photo and re-upload it — burning a second Cloudinary asset and
 * losing the photo's position in the gallery. This is a pure text-metadata
 * PATCH: `caption`, `description`, `alt`, and `attribution` only. It can
 * never touch `url`, `publicId`, `moderationState`, `state`, `isFeatured`,
 * `sortOrder`, or `accommodationId` — those columns are not reachable from
 * `AccommodationMediaUpdatePayloadSchema` even if the client sends them.
 *
 * All four fields are nullable: omit a field to leave it untouched, send
 * `null` to clear it, send a value to replace it. At least one field must be
 * present — an empty body is rejected as `VALIDATION_ERROR`, not a silent 200.
 */

import { EntitlementKey } from '@repo/billing';
import {
    AccommodationIdSchema,
    AccommodationMediaIdSchema,
    AccommodationMediaSingleOutputSchema,
    type AccommodationMediaUpdatePayload,
    AccommodationMediaUpdatePayloadSchema
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { requireEntitlement } from '../../../middlewares/entitlement';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * PATCH /api/v1/protected/accommodations/:id/media/:mediaId
 * Correct photo text metadata — Protected endpoint
 *
 * Permission model: service layer `accommodationService.updateMedia` calls
 * `_canUpdate(actor, accommodation)` which enforces `ACCOMMODATION_UPDATE_ANY`
 * OR (`ACCOMMODATION_UPDATE_OWN` + ownership) — same gate as `reorderMedia`
 * and `setFeaturedMedia`. Route requires `EDIT_ACCOMMODATION_INFO`
 * entitlement — gallery mutation gate.
 *
 * A media row belonging to another accommodation, a non-existent id, or a
 * soft-deleted row all answer `NOT_FOUND` (404) — never `FORBIDDEN` (403),
 * so a foreign id cannot be confirmed to exist.
 */
export const protectedUpdateMediaRoute = createCRUDRoute({
    method: 'patch',
    path: '/{id}/media/{mediaId}',
    summary: 'Correct photo text metadata in accommodation gallery (owner)',
    description:
        'Patch caption/description/alt/attribution on an existing media row. ' +
        'Each field is nullable: omit to leave unchanged, null to clear, a value ' +
        'to replace. At least one field must be present. Requires ' +
        'EDIT_ACCOMMODATION_INFO entitlement; the service layer enforces ' +
        'UPDATE_OWN + ownership.',
    tags: ['Accommodations', 'Media'],
    requestParams: {
        id: AccommodationIdSchema,
        mediaId: AccommodationMediaIdSchema
    },
    requestBody: AccommodationMediaUpdatePayloadSchema,
    responseSchema: AccommodationMediaSingleOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const payload = body as AccommodationMediaUpdatePayload;

        const result = await accommodationService.updateMedia(actor, {
            accommodationId: params.id as string,
            mediaId: params.mediaId as string,
            caption: payload.caption,
            description: payload.description,
            alt: payload.alt,
            attribution: payload.attribution
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        // HOS-388: gallery mutation requires EDIT_ACCOMMODATION_INFO (mirrors
        // reorderMedia / setFeaturedMedia).
        middlewares: [requireEntitlement(EntitlementKey.EDIT_ACCOMMODATION_INFO)]
    }
});
