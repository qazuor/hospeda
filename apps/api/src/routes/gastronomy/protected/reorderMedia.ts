/**
 * PATCH /api/v1/protected/gastronomies/:id/media/reorder
 * Reorder photos in a gastronomy listing gallery (HOS-372).
 *
 * The caller supplies the full ordered list of visible media UUIDs. The service
 * validates that the supplied set matches the current visible rows exactly (no
 * extras, no missing entries, no duplicates) and then applies the new
 * `sortOrder` positions in a single transaction.
 *
 * Gated on COMMERCE_EDIT_OWN (listing owner) or COMMERCE_EDIT_ALL (staff) —
 * enforced inside `reorderGastronomyMedia` via `checkGastronomyCanEditMedia`.
 *
 * NOTE: `index.ts` registers this before /{id}/media/{mediaId} by convention.
 * That is defensive, not required — Hono resolves the static `reorder` segment
 * ahead of the `{mediaId}` param regardless of insertion order (verified by
 * mutation on the post/event twin, `test/routes/post-protected-media.test.ts`;
 * there is no commerce-side route test to re-run it against).
 */
import {
    GastronomyMediaListOutputSchema,
    type GastronomyMediaReorderPayload,
    GastronomyMediaReorderPayloadSchema
} from '@repo/schemas';
import { GastronomyService, reorderGastronomyMedia, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * Route handler — reorders the gallery photos on a gastronomy listing.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service instance
 * to pass to the standalone media helper without requiring a public accessor.
 */
export const protectedReorderGastronomyMediaRoute = createCRUDRoute({
    method: 'patch',
    path: '/{id}/media/reorder',
    summary: 'Reorder gastronomy listing gallery photos',
    description:
        'Sets the sortOrder for the visible gallery photos by supplying their UUIDs ' +
        'in the desired order. The supplied list must match the current visible rows ' +
        'exactly. Requires COMMERCE_EDIT_OWN (listing owner) or COMMERCE_EDIT_ALL (staff).',
    tags: ['Gastronomy', 'Gastronomy Media'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: GastronomyMediaReorderPayloadSchema,
    responseSchema: GastronomyMediaListOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            gastronomyService as unknown as { model: Parameters<typeof reorderGastronomyMedia>[0] }
        ).model;
        const result = await reorderGastronomyMedia(model, actor, {
            gastronomyId: params.id as string,
            orderedIds: (body as GastronomyMediaReorderPayload).orderedIds
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { media: result.data?.media ?? [] };
    }
});
