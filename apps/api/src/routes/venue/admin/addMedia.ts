/**
 * POST /api/v1/admin/gastronomies/:id/media
 * Add a photo to a gastronomy listing gallery — Admin endpoint (HOS-372).
 *
 * This is a URL-receiver endpoint: the caller has already uploaded the file to
 * Cloudinary via `POST /api/v1/admin/media/upload`. This endpoint registers the
 * returned URL + metadata as a new `venue_media` row.
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
import { runListingContentCall } from '../../../middlewares/listing-access';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });

/**
 * POST /api/v1/admin/gastronomies/:id/media
 * Add photo to gastronomy listing gallery — Admin endpoint.
 *
 * Requires VENUE_EDIT_ALL permission. The service helper
 * `addVenueMedia` enforces the same gate via `checkVenueCanEditMedia`.
 */
export const adminAddVenueMediaRoute = createAdminRoute({
    method: 'post',
    listingAccess: { vertical: VerticalEnum.VENUE, operation: 'EDIT', idParam: 'id' },
    path: '/{id}/media',
    summary: 'Add photo to gastronomy listing gallery (admin)',
    description:
        'Registers an already-uploaded URL as a new venue_media row. Requires VENUE_EDIT_ALL.',
    tags: ['Gastronomy', 'Media'],
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
        const result = await runListingContentCall({
            ctx,
            run: () => addVenueMedia(model, actor, input)
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
