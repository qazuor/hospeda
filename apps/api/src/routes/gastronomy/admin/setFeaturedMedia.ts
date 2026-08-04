/**
 * PUT /api/v1/admin/gastronomies/:id/media/:mediaId/featured
 * Set the featured photo for a gastronomy listing gallery — Admin endpoint (HOS-372).
 *
 * Promotes the target `gastronomy_media` row to `is_featured = true` and
 * demotes the previous featured row (if any) back to `is_featured = false`.
 * Both operations run in a single DB transaction — clear-then-set order is
 * mandatory to avoid transiently violating the partial unique index on
 * (gastronomy_id) WHERE is_featured = true AND deleted_at IS NULL.
 *
 * The target media row MUST be `state = 'visible'` — archived photos are
 * rejected before reaching the DB (CHECK constraint guard).
 *
 * No request body — gastronomyId and mediaId come from URL params.
 */
import { GastronomyMediaSingleOutputSchema, PermissionEnum } from '@repo/schemas';
import { GastronomyService, ServiceError, setFeaturedGastronomyMedia } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/gastronomies/:id/media/:mediaId/featured
 * Set featured photo for gastronomy listing gallery — Admin endpoint.
 *
 * Requires COMMERCE_EDIT_ALL permission. The service helper
 * `setFeaturedGastronomyMedia` enforces the same gate via `checkGastronomyCanEditMedia`.
 */
export const adminSetFeaturedGastronomyMediaRoute = createAdminRoute({
    method: 'put',
    path: '/{id}/media/{mediaId}/featured',
    summary: 'Set featured photo for gastronomy listing gallery (admin)',
    description:
        'Promotes the target media row to is_featured=true and demotes the previous ' +
        'featured row (if any). Archived photos cannot be featured — restore the ' +
        'photo to visible first. Requires COMMERCE_EDIT_ALL. No request body — ids ' +
        'come from URL params.',
    tags: ['Gastronomy', 'Media'],
    requiredPermissions: [PermissionEnum.COMMERCE_EDIT_ALL],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
        mediaId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: GastronomyMediaSingleOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            gastronomyService as unknown as {
                model: Parameters<typeof setFeaturedGastronomyMedia>[0];
            }
        ).model;
        const result = await setFeaturedGastronomyMedia(model, actor, {
            gastronomyId: params.id as string,
            mediaId: params.mediaId as string
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
