/**
 * GET /api/v1/admin/experiences/:id/media
 * List photos in an experience listing gallery — Admin endpoint (HOS-372).
 *
 * Returns all non-deleted media rows for the given listing, ordered by
 * `sortOrder ASC`. Supports an optional `state` query filter (defaults to
 * `'visible'`).
 */
import {
    ExperienceMediaListOutputSchema,
    ExperienceMediaStateSchema,
    PermissionEnum
} from '@repo/schemas';
import { ExperienceService, getExperienceMedia, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * GET /api/v1/admin/experiences/:id/media
 * List experience listing gallery photos — Admin endpoint.
 *
 * Requires COMMERCE_EDIT_ALL permission (mirrors the internal
 * `checkExperienceCanEditMedia` gate — media management has no separate
 * broader view-only permission). The service helper `getExperienceMedia`
 * enforces the same gate.
 */
export const adminGetExperienceMediaRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/media',
    summary: 'List experience listing gallery photos (admin)',
    description:
        'Retrieves all media rows for an experience listing, ordered by sortOrder ASC. ' +
        'Supports an optional `state` query filter (default: visible). Requires COMMERCE_EDIT_ALL.',
    tags: ['Experience', 'Media'],
    requiredPermissions: [PermissionEnum.COMMERCE_EDIT_ALL],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestQuery: {
        state: ExperienceMediaStateSchema.optional()
    },
    responseSchema: ExperienceMediaListOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        // Extract optional state query param.
        const rawState = ctx.req.query('state');
        const stateParsed = rawState
            ? ExperienceMediaStateSchema.safeParse(rawState)
            : { success: false as const };
        const state = stateParsed.success ? stateParsed.data : undefined;

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            experienceService as unknown as { model: Parameters<typeof getExperienceMedia>[0] }
        ).model;
        const result = await getExperienceMedia(model, actor, {
            experienceId: params.id as string,
            state
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { media: result.data?.media ?? [] };
    }
});
