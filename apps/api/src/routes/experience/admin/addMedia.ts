/**
 * POST /api/v1/admin/experiences/:id/media
 * Add a photo to an experience listing gallery — Admin endpoint (HOS-372).
 *
 * This is a URL-receiver endpoint: the caller has already uploaded the file to
 * Cloudinary via `POST /api/v1/admin/media/upload`. This endpoint registers the
 * returned URL + metadata as a new `experience_media` row.
 */
import {
    type ExperienceMediaAddInput,
    type ExperienceMediaAddPayload,
    ExperienceMediaAddPayloadSchema,
    ExperienceMediaSingleOutputSchema,
    PermissionEnum
} from '@repo/schemas';
import { addExperienceMedia, ExperienceService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * POST /api/v1/admin/experiences/:id/media
 * Add photo to experience listing gallery — Admin endpoint.
 *
 * Requires COMMERCE_EDIT_ALL permission. The service helper
 * `addExperienceMedia` enforces the same gate via `checkExperienceCanEditMedia`.
 */
export const adminAddExperienceMediaRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/media',
    summary: 'Add photo to experience listing gallery (admin)',
    description:
        'Registers an already-uploaded URL as a new experience_media row. Requires COMMERCE_EDIT_ALL.',
    tags: ['Experience', 'Media'],
    requiredPermissions: [PermissionEnum.COMMERCE_EDIT_ALL],
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
