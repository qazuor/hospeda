/**
 * DELETE /api/v1/protected/accommodations/:id/media/:mediaId
 * Remove a photo from an accommodation gallery — Protected (owner-facing) endpoint (SPEC-204)
 *
 * Soft-deletes the `accommodation_media` row identified by `mediaId` and
 * resequences the remaining visible rows to a dense 0-based `sortOrder`.
 * Both operations run in a single transaction inside the service.
 *
 * Deletes the Cloudinary binary as well (HOS-372): the service is constructed
 * with the media provider so the asset is removed BEFORE the row, aborting the
 * whole operation if storage fails rather than leaving a permanently-billed
 * orphan. The service is built inside the handler, not at module scope, because
 * `getMediaProvider()` must run after `initializeMediaProvider()` at startup.
 *
 * Ungated: removing one's own photo is always allowed (no entitlement check),
 * mirroring removeFaq which is also ungated on the protected carril.
 */

import {
    AccommodationIdSchema,
    AccommodationMediaIdSchema,
    DeleteResultSchema
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getMediaProvider } from '../../../services/media';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

/**
 * DELETE /api/v1/protected/accommodations/:id/media/:mediaId
 * Remove photo from accommodation gallery — Protected endpoint
 *
 * Permission model (SPEC-204): service layer `accommodationService.removeMedia`
 * calls `_canUpdate(actor, accommodation)` which enforces
 * `ACCOMMODATION_UPDATE_ANY` OR (`ACCOMMODATION_UPDATE_OWN` + ownership).
 * Route is ungated — removing one's own photo is always permitted.
 */
export const protectedRemoveMediaRoute = createCRUDRoute({
    method: 'delete',
    path: '/{id}/media/{mediaId}',
    summary: 'Remove photo from accommodation gallery (owner)',
    description:
        'Soft-delete a media row and resequence remaining visible photos. ' +
        'Deletes the Cloudinary asset before the row. Ungated — removing own photos is always permitted; ' +
        'the service layer enforces UPDATE_OWN + ownership.',
    tags: ['Accommodations', 'Media'],
    requestParams: {
        id: AccommodationIdSchema,
        mediaId: AccommodationMediaIdSchema
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const accommodationService = new AccommodationService(
            { logger: apiLogger },
            undefined,
            getMediaProvider()
        );

        const result = await accommodationService.removeMedia(actor, {
            accommodationId: params.id as string,
            mediaId: params.mediaId as string
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            success: true,
            data: result.data
        };
    }
});
