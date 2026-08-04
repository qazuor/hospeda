/**
 * PATCH /api/v1/admin/experiences/:id/media/reorder
 * Reorder photos in an experience listing gallery — Admin endpoint (HOS-372).
 *
 * The caller supplies the full ordered list of visible media UUIDs. The service
 * validates that the supplied set matches the current visible rows exactly (no
 * extras, no missing entries, no duplicates) and then applies the new
 * `sortOrder` positions in a single transaction.
 *
 * MUST be registered BEFORE /{id}/media/{mediaId} to prevent "reorder" from
 * being captured as a mediaId param.
 */
import {
    ExperienceMediaListOutputSchema,
    type ExperienceMediaReorderPayload,
    ExperienceMediaReorderPayloadSchema,
    PermissionEnum
} from '@repo/schemas';
import { ExperienceService, reorderExperienceMedia, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/experiences/:id/media/reorder
 * Reorder experience listing gallery photos — Admin endpoint.
 *
 * Requires COMMERCE_EDIT_ALL permission. The service helper
 * `reorderExperienceMedia` enforces the same gate via `checkExperienceCanEditMedia`.
 */
export const adminReorderExperienceMediaRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}/media/reorder',
    summary: 'Reorder experience listing gallery photos (admin)',
    description:
        'Sets the sortOrder for the visible gallery photos by supplying their UUIDs ' +
        'in the desired order. The supplied list must match the current visible rows ' +
        'exactly. Requires COMMERCE_EDIT_ALL.',
    tags: ['Experience', 'Media'],
    requiredPermissions: [PermissionEnum.COMMERCE_EDIT_ALL],
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
