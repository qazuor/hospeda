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
import { createCRUDRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * POST /api/v1/protected/accommodations/:id/media
 * Add a photo to an accommodation gallery — Protected endpoint
 *
 * Permission model (SPEC-204): service layer `accommodationService.addMedia`
 * calls `_canUpdate(actor, accommodation)` which enforces
 * `ACCOMMODATION_UPDATE_ANY` OR (`ACCOMMODATION_UPDATE_OWN` + ownership).
 * Route requires `EDIT_ACCOMMODATION_INFO` entitlement (granted on all host plans)
 * plus an inline plan photo-count cap check.
 */
export const protectedAddMediaRoute = createCRUDRoute({
    method: 'post',
    path: '/{id}/media',
    summary: 'Add photo to accommodation gallery (owner)',
    description:
        'Register an already-uploaded URL as a new accommodation_media row. ' +
        'Requires EDIT_ACCOMMODATION_INFO entitlement. Plan photo cap is enforced ' +
        'inline. The service layer enforces UPDATE_OWN + ownership.',
    tags: ['Accommodations', 'Media'],
    requestParams: {
        id: AccommodationIdSchema
    },
    requestBody: AccommodationMediaAddPayloadSchema,
    responseSchema: AccommodationMediaSingleOutputSchema,
    // HOS-1352: transitional until V3 (HOS-1357), see PR — removed EDIT_ACCOMMODATION_INFO entitlement gate.
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;

        // ── Plan cap enforcement ──────────────────────────────────────────────
        // For protected owner-actors, `ownerId === actor.id` is always true for
        // their own accommodations, so the plan cap ALWAYS applies.
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
    },
    options: {
        // SPEC-145 T-004 / SPEC-204: gallery mutation requires EDIT_ACCOMMODATION_INFO.
    }
});
