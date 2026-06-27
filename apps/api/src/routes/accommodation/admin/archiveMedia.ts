/**
 * POST /api/v1/admin/accommodations/:id/media/:mediaId/archive
 * Archive a single accommodation photo — Admin endpoint (SPEC-204 T-021a)
 *
 * Flips the target `accommodation_media` row to `state = 'archived'` and sets
 * `archivedAt = NOW()`. The row is NOT soft-deleted — it remains queryable and
 * can be restored via the restore endpoint (T-021b).
 *
 * DB invariants (018-accommodation-media.constraints.sql):
 *   CHECK: NOT (is_featured AND state = 'archived') — featured photos cannot be
 *   archived. The service rejects featured targets before reaching the DB to
 *   surface an actionable error message.
 *
 * This is the per-photo admin archive endpoint — distinct from the billing
 * downgrade archive that works by URL/count on the full gallery.
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
 * POST /api/v1/admin/accommodations/:id/media/:mediaId/archive
 * Archive photo in accommodation gallery — Admin endpoint
 *
 * Permission model (SPEC-204): service layer `accommodationService.archiveMedia`
 * calls `_canUpdate(actor, accommodation)` which enforces
 * `ACCOMMODATION_UPDATE_ANY` OR (`ACCOMMODATION_UPDATE_OWN` + ownership).
 * Route only requires admin-panel access so HOSTs can archive photos on their
 * own accommodations.
 *
 * Guards enforced by the service:
 * - Only `state = 'visible'` rows can be archived (idempotency guard).
 * - Featured photos are rejected with a clear error — unfeature first.
 */
export const adminArchiveMediaRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/media/{mediaId}/archive',
    summary: 'Archive photo in accommodation gallery (admin)',
    description:
        'Flips the target media row to state=archived and sets archivedAt=NOW(). ' +
        'Only visible photos can be archived; featured photos must be unfeatured first. ' +
        'Does NOT soft-delete the row — it remains restorable. ' +
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

        const result = await accommodationService.archiveMedia(actor, {
            accommodationId: params.id as string,
            mediaId: params.mediaId as string
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
