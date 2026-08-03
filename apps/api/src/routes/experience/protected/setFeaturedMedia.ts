/**
 * PUT /api/v1/protected/experiences/:id/media/:mediaId/featured
 * Set the featured photo for an experience listing gallery (HOS-372).
 *
 * Promotes the target `experience_media` row to `is_featured = true` and
 * demotes the previous featured row (if any) back to `is_featured = false`.
 * Both operations run in a single DB transaction — clear-then-set order is
 * mandatory to avoid transiently violating the partial unique index on
 * (experience_id) WHERE is_featured = true AND deleted_at IS NULL.
 *
 * The target media row MUST be `state = 'visible'` — archived photos are
 * rejected before reaching the DB (CHECK constraint guard).
 *
 * No request body — experienceId and mediaId come from URL params.
 *
 * Gated on COMMERCE_EDIT_OWN (listing owner) or COMMERCE_EDIT_ALL (staff) —
 * enforced inside `setFeaturedExperienceMedia` via `checkExperienceCanEditMedia`.
 *
 * NOTE: this route must be registered BEFORE /{id}/media/{mediaId} (DELETE)
 * so Hono resolves the fixed "/featured" suffix unambiguously.
 */
import { ExperienceMediaSingleOutputSchema } from '@repo/schemas';
import { ExperienceService, ServiceError, setFeaturedExperienceMedia } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * Route handler — promotes a photo to featured on an experience listing.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service instance
 * to pass to the standalone media helper without requiring a public accessor.
 */
export const protectedSetFeaturedExperienceMediaRoute = createCRUDRoute({
    method: 'put',
    path: '/{id}/media/{mediaId}/featured',
    summary: 'Set featured photo for experience listing gallery',
    description:
        'Promotes the target media row to is_featured=true and demotes the previous ' +
        'featured row (if any). Archived photos cannot be featured — restore the ' +
        'photo to visible first. Requires COMMERCE_EDIT_OWN (listing owner) or ' +
        'COMMERCE_EDIT_ALL (staff). No request body — ids come from URL params.',
    tags: ['Experience', 'Experience Media'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
        mediaId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: ExperienceMediaSingleOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            experienceService as unknown as {
                model: Parameters<typeof setFeaturedExperienceMedia>[0];
            }
        ).model;
        const result = await setFeaturedExperienceMedia(model, actor, {
            experienceId: params.id as string,
            mediaId: params.mediaId as string
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
