/**
 * POST /api/v1/protected/experiences/:id/media
 * Add a photo to an experience listing gallery (HOS-372).
 *
 * This is a URL-receiver endpoint: the caller has already uploaded the file to
 * Cloudinary via `POST /api/v1/admin/media/upload`. This endpoint registers the
 * returned URL + metadata as a new `experience_media` row.
 *
 * Gated on COMMERCE_EDIT_OWN (listing owner) or COMMERCE_EDIT_ALL (staff) —
 * enforced inside `addExperienceMedia` via `checkExperienceCanEditMedia`.
 */
import {
    type ExperienceMediaAddInput,
    type ExperienceMediaAddPayload,
    ExperienceMediaAddPayloadSchema,
    ExperienceMediaSingleOutputSchema
} from '@repo/schemas';
import { addExperienceMedia, ExperienceService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * Route handler — adds a photo to the specified experience listing's gallery.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service instance
 * to pass to the standalone media helper without requiring a public accessor.
 */
export const protectedAddExperienceMediaRoute = createCRUDRoute({
    method: 'post',
    path: '/{id}/media',
    summary: 'Add photo to experience listing gallery',
    description:
        'Registers an already-uploaded URL as a new experience_media row. ' +
        'Requires COMMERCE_EDIT_OWN (listing owner) or COMMERCE_EDIT_ALL (staff).',
    tags: ['Experience', 'Experience Media'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: ExperienceMediaAddPayloadSchema,
    responseSchema: ExperienceMediaSingleOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const input: ExperienceMediaAddInput = {
            experienceId: params.id as string,
            media: body as ExperienceMediaAddPayload
        };

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            experienceService as unknown as { model: Parameters<typeof addExperienceMedia>[0] }
        ).model;
        const result = await addExperienceMedia(model, actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
