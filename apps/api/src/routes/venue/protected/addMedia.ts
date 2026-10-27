/**
 * POST /api/v1/protected/gastronomies/:id/media
 * Add a photo to a gastronomy listing gallery (HOS-372).
 *
 * This is a URL-receiver endpoint: the caller has already uploaded the file to
 * Cloudinary via `POST /api/v1/admin/media/upload`. This endpoint registers the
 * returned URL + metadata as a new `venue_media` row.
 *
 * Gated on VENUE_EDIT_OWN (listing owner) or VENUE_EDIT_ALL (staff) —
 * enforced inside `addVenueMedia` via `checkVenueCanEditMedia`.
 */

import {
    type VenueMediaAddInput,
    type VenueMediaAddPayload,
    VenueMediaAddPayloadSchema,
    VenueMediaSingleOutputSchema,
    VerticalEnum
} from '@repo/schemas';
import { addVenueMedia, ServiceError, VenueService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';

import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });

/**
 * Route handler — adds a photo to the specified gastronomy listing's gallery.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service instance
 * to pass to the standalone media helper without requiring a public accessor.
 */
export const protectedAddVenueMediaRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/media',
    summary: 'Add photo to gastronomy listing gallery',
    description:
        'Registers an already-uploaded URL as a new venue_media row. ' +
        'Requires VENUE_EDIT_OWN (listing owner) or VENUE_EDIT_ALL (staff).',
    listingAccess: { vertical: VerticalEnum.VENUE, operation: 'EDIT', idParam: 'id' },
    tags: ['Gastronomy', 'Gastronomy Media'],
    protectedTag: false,
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: VenueMediaAddPayloadSchema,
    responseSchema: VenueMediaSingleOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const input: VenueMediaAddInput = {
            gastronomyId: params.id as string,
            media: body as VenueMediaAddPayload
        };

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (venueService as unknown as { model: Parameters<typeof addVenueMedia>[0] })
            .model;
        const result = await addVenueMedia(model, actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
