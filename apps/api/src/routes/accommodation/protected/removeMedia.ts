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

import { EntitlementKey } from '@repo/billing';
import {
    AccommodationIdSchema,
    AccommodationMediaIdSchema,
    DeleteResultSchema,
    ProductDomainEnum
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { requireEntitlement } from '../../../middlewares/entitlement';
import { requireLiveSubscription } from '../../../middlewares/require-live-subscription';
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
    },
    options: {
        // HOS-1275: DELETING content is mutating it. These two routes carried no
        // entitlement gate at all — not in commerce, and not in accommodation
        // either, which PR #3299's own write-up missed because it only surveyed
        // commerce. Wired here with the same pair every sibling content route
        // carries, so the six of them stop being the exception that the next
        // change to the EDIT_* keys would silently leave behind.
        middlewares: [
            requireEntitlement(EntitlementKey.EDIT_ACCOMMODATION_INFO),
            requireLiveSubscription(ProductDomainEnum.ACCOMMODATION)
        ]
    }
});
