/**
 * DELETE /api/v1/admin/experiences/:id/media/:mediaId
 * Remove (soft-delete) a photo from an experience listing gallery — Admin endpoint (HOS-372).
 *
 * Soft-deletes the `experience_media` row identified by `mediaId` and
 * resequences the remaining visible rows to a dense 0-based `sortOrder`.
 *
 * Deletes the Cloudinary binary as well (HOS-372): the provider is passed down
 * so the asset is removed BEFORE the row, aborting the whole operation if
 * storage fails rather than leaving a permanently-billed orphan.
 */
import { PermissionEnum, SuccessSchema } from '@repo/schemas';
import { ExperienceService, removeExperienceMedia, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getMediaProvider } from '../../../services/media';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/experiences/:id/media/:mediaId
 * Remove photo from experience listing gallery — Admin endpoint.
 *
 * Requires COMMERCE_EDIT_ALL permission. The service helper
 * `removeExperienceMedia` enforces the same gate via `checkExperienceCanEditMedia`.
 */
export const adminRemoveExperienceMediaRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/media/{mediaId}',
    summary: 'Remove photo from experience listing gallery (admin)',
    description:
        'Soft-deletes a media row and resequences the remaining visible photos. Requires COMMERCE_EDIT_ALL.',
    tags: ['Experience', 'Media'],
    requiredPermissions: [PermissionEnum.COMMERCE_EDIT_ALL],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
        mediaId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: SuccessSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            experienceService as unknown as { model: Parameters<typeof removeExperienceMedia>[0] }
        ).model;
        const result = await removeExperienceMedia(
            model,
            actor,
            {
                experienceId: params.id as string,
                mediaId: params.mediaId as string
            },
            getMediaProvider()
        );

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data ?? { success: true };
    }
});
