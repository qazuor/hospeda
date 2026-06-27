/**
 * POST /api/v1/admin/accommodations/:id/media/:mediaId/restore
 * Restore an archived accommodation photo — Admin endpoint (SPEC-204 T-021b)
 *
 * Flips the target `accommodation_media` row back to `state = 'visible'`,
 * clears `archivedAt = NULL`, and appends it at the END of the current visible
 * gallery by assigning `sortOrder = max(current visible sortOrder) + 1`.
 *
 * Plan photo cap on restore: NOT enforced. Restoring a previously-visible photo
 * that already exists in the DB is treated as a management action, not a new
 * upload. The cap is enforced at the addMedia / upload routes where new binary
 * assets are first registered. See service JSDoc for the full rationale.
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
 * POST /api/v1/admin/accommodations/:id/media/:mediaId/restore
 * Restore archived photo to accommodation gallery — Admin endpoint
 *
 * Permission model (SPEC-204): service layer `accommodationService.restoreMedia`
 * calls `_canUpdate(actor, accommodation)` which enforces
 * `ACCOMMODATION_UPDATE_ANY` OR (`ACCOMMODATION_UPDATE_OWN` + ownership).
 * Route only requires admin-panel access so HOSTs can restore photos on their
 * own accommodations.
 *
 * Guards enforced by the service:
 * - Only `state = 'archived'` rows can be restored (idempotency guard).
 * - sortOrder is assigned as max(visible) + 1 (append-at-end convention).
 *
 * Plan photo cap is intentionally NOT enforced here — see module JSDoc above.
 */
export const adminRestoreMediaRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/media/{mediaId}/restore',
    summary: 'Restore archived photo to accommodation gallery (admin)',
    description:
        'Flips the target media row to state=visible, clears archivedAt, and ' +
        'assigns sortOrder=max(visible)+1 (appends at end of gallery). ' +
        'Only archived photos can be restored. Plan photo cap is not enforced on ' +
        'restore — see service layer for rationale. ' +
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

        const result = await accommodationService.restoreMedia(actor, {
            accommodationId: params.id as string,
            mediaId: params.mediaId as string
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
