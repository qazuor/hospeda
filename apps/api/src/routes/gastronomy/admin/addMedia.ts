/**
 * POST /api/v1/admin/gastronomies/:id/media
 * Add a photo to a gastronomy listing gallery — Admin endpoint (HOS-372).
 *
 * This is a URL-receiver endpoint: the caller has already uploaded the file to
 * Cloudinary via `POST /api/v1/admin/media/upload`. This endpoint registers the
 * returned URL + metadata as a new `gastronomy_media` row.
 */
import {
    type GastronomyMediaAddInput,
    type GastronomyMediaAddPayload,
    GastronomyMediaAddPayloadSchema,
    GastronomyMediaSingleOutputSchema,
    PermissionEnum
} from '@repo/schemas';
import { addGastronomyMedia, GastronomyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * POST /api/v1/admin/gastronomies/:id/media
 * Add photo to gastronomy listing gallery — Admin endpoint.
 *
 * Requires COMMERCE_EDIT_ALL permission. The service helper
 * `addGastronomyMedia` enforces the same gate via `checkGastronomyCanEditMedia`.
 */
export const adminAddGastronomyMediaRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/media',
    summary: 'Add photo to gastronomy listing gallery (admin)',
    description:
        'Registers an already-uploaded URL as a new gastronomy_media row. Requires COMMERCE_EDIT_ALL.',
    tags: ['Gastronomy', 'Media'],
    requiredPermissions: [PermissionEnum.COMMERCE_EDIT_ALL],
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
