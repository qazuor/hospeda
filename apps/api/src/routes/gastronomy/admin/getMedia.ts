/**
 * GET /api/v1/admin/gastronomies/:id/media
 * List photos in a gastronomy listing gallery — Admin endpoint (HOS-372).
 *
 * Returns all non-deleted media rows for the given listing, ordered by
 * `sortOrder ASC`. Supports an optional `state` query filter (defaults to
 * `'visible'`).
 */
import {
    GastronomyMediaListOutputSchema,
    GastronomyMediaStateSchema,
    PermissionEnum
} from '@repo/schemas';
import { GastronomyService, getGastronomyMedia, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * GET /api/v1/admin/gastronomies/:id/media
 * List gastronomy listing gallery photos — Admin endpoint.
 *
 * Requires COMMERCE_EDIT_ALL permission (mirrors the internal
 * `checkGastronomyCanEditMedia` gate — media management has no separate
 * broader view-only permission). The service helper `getGastronomyMedia`
 * enforces the same gate.
 */
export const adminGetGastronomyMediaRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/media',
    summary: 'List gastronomy listing gallery photos (admin)',
    description:
        'Retrieves all media rows for a gastronomy listing, ordered by sortOrder ASC. ' +
        'Supports an optional `state` query filter (default: visible). Requires COMMERCE_EDIT_ALL.',
    tags: ['Gastronomy', 'Media'],
    requiredPermissions: [PermissionEnum.COMMERCE_EDIT_ALL],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestQuery: {
        state: GastronomyMediaStateSchema.optional()
    },
    responseSchema: GastronomyMediaListOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        // Extract optional state query param.
        const rawState = ctx.req.query('state');
        const stateParsed = rawState
            ? GastronomyMediaStateSchema.safeParse(rawState)
            : { success: false as const };
        const state = stateParsed.success ? stateParsed.data : undefined;

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            gastronomyService as unknown as { model: Parameters<typeof getGastronomyMedia>[0] }
        ).model;
        const result = await getGastronomyMedia(model, actor, {
            gastronomyId: params.id as string,
            state
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { media: result.data?.media ?? [] };
    }
});
