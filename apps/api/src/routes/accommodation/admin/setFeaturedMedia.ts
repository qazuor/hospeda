/**
 * PUT /api/v1/admin/accommodations/:id/media/:mediaId/featured
 * Set the featured photo for an accommodation gallery — Admin endpoint (SPEC-204 T-020)
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
 */

import {
    AccommodationIdSchema,
    AccommodationMediaIdSchema,
    AccommodationMediaSingleOutputSchema
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/accommodations/:id/media/:mediaId/featured
 * Set featured photo for accommodation gallery — Admin endpoint
 *
 * Permission model (SPEC-204): service layer `accommodationService.setFeaturedMedia`
 * calls `_canUpdate(actor, accommodation)` which enforces
 * `ACCOMMODATION_UPDATE_ANY` OR (`ACCOMMODATION_UPDATE_OWN` + ownership).
 * Route only requires admin-panel access so HOSTs can manage featured photos on
 * their own accommodations.
 *
 * The target media row MUST be `state = 'visible'`. Archived photos are rejected
 * before reaching the DB (see DB invariant 2 above).
 */
export const adminSetFeaturedMediaRoute = createAdminRoute({
    method: 'put',
    path: '/{id}/media/{mediaId}/featured',
    summary: 'Set featured photo for accommodation gallery (admin)',
    description:
        'Promotes the target media row to is_featured=true and demotes the previous ' +
        'featured row (if any). Both updates run in a single transaction. ' +
        'Archived photos cannot be featured — restore the photo to visible first. ' +
        'Requires admin-panel access; the service layer enforces UPDATE_ANY or ' +
        '(UPDATE_OWN + ownership). No request body — ids come from URL params.',
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
    }
});
