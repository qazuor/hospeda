/**
 * POST /api/v1/admin/accommodations/:id/media
 * Add a photo to an accommodation gallery - Admin endpoint (SPEC-204)
 *
 * This is a URL-receiver endpoint: the caller has already uploaded the file to
 * Cloudinary via `POST /api/v1/admin/media/upload`. This endpoint registers the
 * returned URL + metadata as a new `accommodation_media` row.
 *
 * Gallery registration runs without the former plan photo cap during the billing transition.
 * HOS-1352: transitional until V3 (HOS-1357), see PR — the former plan gate or limit is removed.
 */

import {
    AccommodationIdSchema,
    type AccommodationMediaAddInput,
    type AccommodationMediaAddPayload,
    AccommodationMediaAddPayloadSchema,
    AccommodationMediaSingleOutputSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';

import { getActorFromContext } from '../../../utils/actor';

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
 * §3d-i exactly. Only applies when the actor IS the owner; admin overrides bypass.
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
    // HOS-1352: transitional until V3 (HOS-1357), see PR — removed MAX_PHOTOS_PER_ACCOMMODATION plan limit.
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;

        // ── Plan cap enforcement (mirrors upload.ts §3d-i) ────────────────────
        // Only enforces when the actor is the owner. Admins uploading on behalf
        // of an owner bypass the plan limit — this matches `validateEntityMedia
        // Permission` where admins with ACCOMMODATION_UPDATE_ANY skip ownership.
        // The count is GALLERY-ONLY (`isFeatured: false`, HOS-791). The featured
        // image is not a gallery item and does not consume a plan photo slot, so
        // an owner on a 15-photo plan keeps 15 gallery photos plus their featured
        // one. Counting them together closed the gallery one photo early and
        // reported "15/15" while the owner could only see 14.
        const accommodation = await accommodationService.getById(actor, accommodationId);
        if (accommodation.error || !accommodation.data) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
        }

        // The per-plan gallery photo cap (MAX_PHOTOS_PER_ACCOMMODATION) was
        // removed with the legacy billing system (HOS-1416).

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
