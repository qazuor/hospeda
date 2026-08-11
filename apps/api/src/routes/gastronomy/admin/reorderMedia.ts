/**
 * PATCH /api/v1/admin/gastronomies/:id/media/reorder
 * Reorder photos in a gastronomy listing gallery — Admin endpoint (HOS-372).
 *
 * The caller supplies the full ordered list of visible media UUIDs. The service
 * validates that the supplied set matches the current visible rows exactly (no
 * extras, no missing entries, no duplicates) and then applies the new
 * `sortOrder` positions in a single transaction.
 *
 * `index.ts` registers this before /{id}/media/{mediaId} by convention. That is
 * defensive, not required — Hono resolves the static `reorder` segment ahead of
 * the `{mediaId}` param regardless of insertion order (verified by mutation on
 * the post/event twin, `test/routes/post-protected-media.test.ts`).
 */
import {
    GastronomyMediaListOutputSchema,
    type GastronomyMediaReorderPayload,
    GastronomyMediaReorderPayloadSchema,
    PermissionEnum
} from '@repo/schemas';
import { GastronomyService, reorderGastronomyMedia, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/gastronomies/:id/media/reorder
 * Reorder gastronomy listing gallery photos — Admin endpoint.
 *
 * Requires COMMERCE_EDIT_ALL permission. The service helper
 * `reorderGastronomyMedia` enforces the same gate via `checkGastronomyCanEditMedia`.
 */
export const adminReorderGastronomyMediaRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}/media/reorder',
    summary: 'Reorder gastronomy listing gallery photos (admin)',
    description:
        'Sets the sortOrder for the visible gallery photos by supplying their UUIDs ' +
        'in the desired order. The supplied list must match the current visible rows ' +
        'exactly. Requires COMMERCE_EDIT_ALL.',
    tags: ['Gastronomy', 'Media'],
    requiredPermissions: [PermissionEnum.COMMERCE_EDIT_ALL],
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
