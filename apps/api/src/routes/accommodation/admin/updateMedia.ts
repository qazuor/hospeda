/**
 * PATCH /api/v1/admin/accommodations/:id/media/:mediaId
 * Correct the text metadata of an accommodation gallery photo — Admin endpoint
 * (HOS-388)
 *
 * The admin twin of `protected/updateMedia.ts`. Both delegate to the same
 * `AccommodationService.updateMedia`, so the rules that matter — which columns
 * are reachable, what `null` means, what an empty body does, and that a foreign
 * or deleted row answers 404 rather than 403 — live in the service and cannot
 * drift between the two tiers.
 *
 * The protected tier shipped first because the host is who writes the text in
 * the first place. This tier exists because staff moderating a listing had no
 * way to fix an `alt` that is wrong, misleading, or in the wrong language, on a
 * row they do not own.
 *
 * Text metadata only: `caption`, `description`, `alt`, `attribution`. It can
 * never touch `url`, `publicId`, `moderationState`, `state`, `isFeatured`,
 * `sortOrder` or `accommodationId` — those columns are not reachable from
 * `AccommodationMediaUpdatePayloadSchema` even if the client sends them.
 */

import {
    AccommodationIdSchema,
    AccommodationMediaIdSchema,
    AccommodationMediaSingleOutputSchema,
    type AccommodationMediaUpdatePayload,
    AccommodationMediaUpdatePayloadSchema
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/accommodations/:id/media/:mediaId
 * Correct photo text metadata — Admin endpoint
 *
 * Permission model: identical to the sibling admin media routes
 * (`setFeaturedMedia`, `archiveMedia`, `restoreMedia`). The route requires
 * admin-panel access only; the service layer's `_canUpdate(actor, accommodation)`
 * enforces `ACCOMMODATION_UPDATE_ANY` OR (`ACCOMMODATION_UPDATE_OWN` +
 * ownership). Keeping it that way is deliberate: a HOST reaching their own
 * listing through the admin panel must be able to fix their own photo text, and
 * pinning `UPDATE_ANY` here would lock them out of a row they own.
 *
 * No entitlement gate, unlike the protected tier's `EDIT_ACCOMMODATION_INFO`.
 * Staff bypass entitlements (INV-6), so the gate would be dead weight on this
 * path — and a moderator correcting misleading alt text is not exercising a
 * billable feature.
 *
 * A media row belonging to another accommodation, a non-existent id, or a
 * soft-deleted row all answer `NOT_FOUND` (404) — never `FORBIDDEN` (403), so a
 * foreign id cannot be confirmed to exist.
 */
export const adminUpdateMediaRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}/media/{mediaId}',
    summary: 'Correct photo text metadata in accommodation gallery (admin)',
    description:
        'Patch caption/description/alt/attribution on an existing media row. ' +
        'Each field is nullable: omit to leave unchanged, null to clear, a value ' +
        'to replace. At least one field must be present — an empty body is a ' +
        'VALIDATION_ERROR, not a silent 200. Requires admin-panel access; the ' +
        'service layer enforces UPDATE_ANY or (UPDATE_OWN + ownership).',
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
    }
});
