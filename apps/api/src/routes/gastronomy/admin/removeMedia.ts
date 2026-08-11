/**
 * DELETE /api/v1/admin/gastronomies/:id/media/:mediaId
 * Remove (soft-delete) a photo from a gastronomy listing gallery — Admin endpoint (HOS-372).
 *
 * Soft-deletes the `gastronomy_media` row identified by `mediaId` and
 * resequences the remaining visible rows to a dense 0-based `sortOrder`.
 *
 * Deletes the Cloudinary binary as well (HOS-372): the provider is passed down
 * so the asset is removed BEFORE the row, aborting the whole operation if
 * storage fails rather than leaving a permanently-billed orphan.
 */
import { PermissionEnum, SuccessSchema } from '@repo/schemas';
import { GastronomyService, removeGastronomyMedia, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getMediaProvider } from '../../../services/media';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/gastronomies/:id/media/:mediaId
 * Remove photo from gastronomy listing gallery — Admin endpoint.
 *
 * Requires COMMERCE_EDIT_ALL permission. The service helper
 * `removeGastronomyMedia` enforces the same gate via `checkGastronomyCanEditMedia`.
 */
export const adminRemoveGastronomyMediaRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/media/{mediaId}',
    summary: 'Remove photo from gastronomy listing gallery (admin)',
    description:
        'Soft-deletes a media row and resequences the remaining visible photos. Requires COMMERCE_EDIT_ALL.',
    tags: ['Gastronomy', 'Media'],
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
            gastronomyService as unknown as { model: Parameters<typeof removeGastronomyMedia>[0] }
        ).model;
        const result = await removeGastronomyMedia(
            model,
            actor,
            {
                gastronomyId: params.id as string,
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
