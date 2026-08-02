/**
 * POST /api/v1/protected/gastronomies/:id/media
 * Add a photo to a gastronomy listing gallery (HOS-372).
 *
 * This is a URL-receiver endpoint: the caller has already uploaded the file to
 * Cloudinary via `POST /api/v1/admin/media/upload`. This endpoint registers the
 * returned URL + metadata as a new `gastronomy_media` row.
 *
 * Gated on COMMERCE_EDIT_OWN (listing owner) or COMMERCE_EDIT_ALL (staff) —
 * enforced inside `addGastronomyMedia` via `checkGastronomyCanEditMedia`.
 */
import {
    type GastronomyMediaAddInput,
    type GastronomyMediaAddPayload,
    GastronomyMediaAddPayloadSchema,
    GastronomyMediaSingleOutputSchema
} from '@repo/schemas';
import { addGastronomyMedia, GastronomyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * Route handler — adds a photo to the specified gastronomy listing's gallery.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service instance
 * to pass to the standalone media helper without requiring a public accessor.
 */
export const protectedAddGastronomyMediaRoute = createCRUDRoute({
    method: 'post',
    path: '/{id}/media',
    summary: 'Add photo to gastronomy listing gallery',
    description:
        'Registers an already-uploaded URL as a new gastronomy_media row. ' +
        'Requires COMMERCE_EDIT_OWN (listing owner) or COMMERCE_EDIT_ALL (staff).',
    tags: ['Gastronomy', 'Gastronomy Media'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: GastronomyMediaAddPayloadSchema,
    responseSchema: GastronomyMediaSingleOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const input: GastronomyMediaAddInput = {
            gastronomyId: params.id as string,
            media: body as GastronomyMediaAddPayload
        };

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            gastronomyService as unknown as { model: Parameters<typeof addGastronomyMedia>[0] }
        ).model;
        const result = await addGastronomyMedia(model, actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
