/**
 * GET /api/v1/protected/gastronomies/:id/media
 * List photos in a gastronomy listing gallery (HOS-372).
 *
 * Returns all non-deleted media rows for the given listing, ordered by
 * `sortOrder ASC`. Supports an optional `state` query filter (defaults to
 * `'visible'`).
 *
 * Gated on COMMERCE_EDIT_OWN (listing owner) or COMMERCE_EDIT_ALL (staff) —
 * enforced inside `getGastronomyMedia` via `checkGastronomyCanEditMedia`. There
 * is no separate public read path for media management.
 */
import { GastronomyMediaListOutputSchema, GastronomyMediaStateSchema } from '@repo/schemas';
import { GastronomyService, getGastronomyMedia, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * Route handler — lists the gallery photos for a gastronomy listing.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service instance
 * to pass to the standalone media helper without requiring a public accessor.
 */
export const protectedGetGastronomyMediaRoute = createCRUDRoute({
    method: 'get',
    path: '/{id}/media',
    summary: 'List gastronomy listing gallery photos',
    description:
        'Retrieves all media rows for a gastronomy listing, ordered by sortOrder ASC. ' +
        'Supports an optional `state` query filter (default: visible). ' +
        'Requires COMMERCE_EDIT_OWN (listing owner) or COMMERCE_EDIT_ALL (staff).',
    tags: ['Gastronomy', 'Gastronomy Media'],
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
