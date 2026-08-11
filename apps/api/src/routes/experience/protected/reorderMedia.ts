/**
 * PATCH /api/v1/protected/experiences/:id/media/reorder
 * Reorder photos in an experience listing gallery (HOS-372).
 *
 * The caller supplies the full ordered list of visible media UUIDs. The service
 * validates that the supplied set matches the current visible rows exactly (no
 * extras, no missing entries, no duplicates) and then applies the new
 * `sortOrder` positions in a single transaction.
 *
 * Gated on COMMERCE_EDIT_OWN (listing owner) or COMMERCE_EDIT_ALL (staff) —
 * enforced inside `reorderExperienceMedia` via `checkExperienceCanEditMedia`.
 *
 * NOTE: `index.ts` registers this before /{id}/media/{mediaId} by convention.
 * That is defensive, not required — Hono resolves the static `reorder` segment
 * ahead of the `{mediaId}` param regardless of insertion order (verified by
 * mutation on the post/event twin, `test/routes/post-protected-media.test.ts`;
 * there is no commerce-side route test to re-run it against).
 */
import {
    ExperienceMediaListOutputSchema,
    type ExperienceMediaReorderPayload,
    ExperienceMediaReorderPayloadSchema
} from '@repo/schemas';
import { ExperienceService, reorderExperienceMedia, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * Route handler — reorders the gallery photos on an experience listing.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service instance
 * to pass to the standalone media helper without requiring a public accessor.
 */
export const protectedReorderExperienceMediaRoute = createCRUDRoute({
    method: 'patch',
    path: '/{id}/media/reorder',
    summary: 'Reorder experience listing gallery photos',
    description:
        'Sets the sortOrder for the visible gallery photos by supplying their UUIDs ' +
        'in the desired order. The supplied list must match the current visible rows ' +
        'exactly. Requires COMMERCE_EDIT_OWN (listing owner) or COMMERCE_EDIT_ALL (staff).',
    tags: ['Experience', 'Experience Media'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: ExperienceMediaReorderPayloadSchema,
    responseSchema: ExperienceMediaListOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            experienceService as unknown as { model: Parameters<typeof reorderExperienceMedia>[0] }
        ).model;
        const result = await reorderExperienceMedia(model, actor, {
            experienceId: params.id as string,
            orderedIds: (body as ExperienceMediaReorderPayload).orderedIds
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { media: result.data?.media ?? [] };
    }
});
