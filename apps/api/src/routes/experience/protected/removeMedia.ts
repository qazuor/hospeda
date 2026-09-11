/**
 * DELETE /api/v1/protected/experiences/:id/media/:mediaId
 * Remove (soft-delete) a photo from an experience listing gallery (HOS-372).
 *
 * Soft-deletes the `experience_media` row identified by `mediaId` and
 * resequences the remaining visible rows to a dense 0-based `sortOrder`.
 * Both operations run in a single transaction inside the service.
 *
 * Deletes the Cloudinary binary as well (HOS-372): the provider is passed down
 * so the asset is removed BEFORE the row, aborting the whole operation if
 * storage fails rather than leaving a permanently-billed orphan.
 *
 * Gated on COMMERCE_EDIT_OWN (listing owner) or COMMERCE_EDIT_ALL (staff) —
 * enforced inside `removeExperienceMedia` via `checkExperienceCanEditMedia`.
 */
import { EntitlementKey } from '@repo/billing';
import { ProductDomainEnum, SuccessSchema } from '@repo/schemas';
import { ExperienceService, removeExperienceMedia, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { commerceVerticalEntitlementMiddleware } from '../../../middlewares/commerce-entitlement';
import { requireEntitlement } from '../../../middlewares/entitlement';
import { requireLiveSubscription } from '../../../middlewares/require-live-subscription';
import { getMediaProvider } from '../../../services/media';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * Route handler — soft-deletes a specific photo from an experience listing gallery.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service instance
 * to pass to the standalone media helper without requiring a public accessor.
 */
export const protectedRemoveExperienceMediaRoute = createCRUDRoute({
    method: 'delete',
    path: '/{id}/media/{mediaId}',
    summary: 'Remove photo from experience listing gallery',
    description:
        'Soft-deletes a media row and resequences the remaining visible photos. ' +
        'Requires EXPERIENCE_EDIT_OWN (listing owner) or EXPERIENCE_EDIT_ALL (staff); the legacy COMMERCE_ equivalents are still accepted until HOS-1077 release 2.',
    tags: ['Experience', 'Experience Media'],
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
    },
    options: {
        // HOS-1275: DELETING content is mutating it. These two routes carried no
        // entitlement gate at all — not in commerce, and not in accommodation
        // either, which PR #3299's own write-up missed because it only surveyed
        // commerce. Wired here with the same pair every sibling content route
        // carries, so the six of them stop being the exception that the next
        // change to the EDIT_* keys would silently leave behind.
        middlewares: [
            commerceVerticalEntitlementMiddleware('experience'),
            requireEntitlement(EntitlementKey.EDIT_EXPERIENCE_INFO),
            requireLiveSubscription(ProductDomainEnum.EXPERIENCE)
        ]
    }
});
