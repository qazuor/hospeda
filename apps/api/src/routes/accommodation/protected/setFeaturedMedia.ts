/**
 * PUT /api/v1/protected/accommodations/:id/media/:mediaId/featured
 * Set the featured photo for an accommodation gallery — Protected (owner-facing) endpoint (SPEC-204)
 *
 * Promotes the target `accommodation_media` row to `is_featured = true` and
 * demotes the previous featured row (if any) back to `is_featured = false`.
 * Both operations run in a single DB transaction — clear-then-set order is
 * mandatory to avoid transiently violating the partial unique index on
 * (accommodation_id) WHERE is_featured = true AND deleted_at IS NULL.
 *
 * DB invariants (018-accommodation-media.constraints.sql):
 *   1. Partial UNIQUE index: at most ONE is_featured=true row per accommodation.
 *   2. CHECK: NOT (is_featured AND state = 'archived') — archived photos cannot
 *      be featured. The service rejects archived targets before reaching the DB.
 *
 * No request body — accommodationId and mediaId come from URL params.
 *
 * IMPORTANT: Must be mounted BEFORE `/:id/media/:mediaId` (DELETE) routes so
 * Hono does not resolve the fixed suffix "/featured" as a `mediaId` UUID param.
 */

import { EntitlementKey } from '@repo/billing';
import {
    AccommodationIdSchema,
    AccommodationMediaIdSchema,
    AccommodationMediaSingleOutputSchema
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { requireEntitlement } from '../../../middlewares/entitlement';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * PUT /api/v1/protected/accommodations/:id/media/:mediaId/featured
 * Set featured photo for accommodation gallery — Protected endpoint
 *
 * Permission model (SPEC-204): service layer `accommodationService.setFeaturedMedia`
 * calls `_canUpdate(actor, accommodation)` which enforces
 * `ACCOMMODATION_UPDATE_ANY` OR (`ACCOMMODATION_UPDATE_OWN` + ownership).
 * Route requires `EDIT_ACCOMMODATION_INFO` entitlement — gallery mutation gate.
 *
 * The target media row MUST be `state = 'visible'`. Archived photos are rejected
 * before reaching the DB (see DB invariant 2 above).
 */
export const protectedSetFeaturedMediaRoute = createCRUDRoute({
    method: 'put',
    path: '/{id}/media/{mediaId}/featured',
    summary: 'Set featured photo for accommodation gallery (owner)',
    description:
        'Promotes the target media row to is_featured=true and demotes the previous ' +
        'featured row (if any). Both updates run in a single transaction. ' +
        'Archived photos cannot be featured — restore the photo to visible first. ' +
        'Requires EDIT_ACCOMMODATION_INFO entitlement; the service layer enforces ' +
        'UPDATE_OWN + ownership. No request body — ids come from URL params.',
    tags: ['Accommodations', 'Media'],
    requestParams: {
        id: AccommodationIdSchema,
        mediaId: AccommodationMediaIdSchema
    },
    responseSchema: AccommodationMediaSingleOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        const result = await accommodationService.setFeaturedMedia(actor, {
            accommodationId: params.id as string,
            mediaId: params.mediaId as string
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        // SPEC-145 T-004 / SPEC-204: gallery mutation requires EDIT_ACCOMMODATION_INFO.
        middlewares: [requireEntitlement(EntitlementKey.EDIT_ACCOMMODATION_INFO)]
    }
});
