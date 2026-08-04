/**
 * GET /api/v1/protected/experiences/:id/media
 * List photos in an experience listing gallery (HOS-372).
 *
 * Returns all non-deleted media rows for the given listing, ordered by
 * `sortOrder ASC`. Supports an optional `state` query filter (defaults to
 * `'visible'`).
 *
 * Gated on COMMERCE_EDIT_OWN (listing owner) or COMMERCE_EDIT_ALL (staff) —
 * enforced inside `getExperienceMedia` via `checkExperienceCanEditMedia`. There
 * is no separate public read path for media management.
 */
import { ExperienceMediaListOutputSchema, ExperienceMediaStateSchema } from '@repo/schemas';
import { ExperienceService, getExperienceMedia, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * Route handler — lists the gallery photos for an experience listing.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service instance
 * to pass to the standalone media helper without requiring a public accessor.
 */
export const protectedGetExperienceMediaRoute = createCRUDRoute({
    method: 'get',
    path: '/{id}/media',
    summary: 'List experience listing gallery photos',
    description:
        'Retrieves all media rows for an experience listing, ordered by sortOrder ASC. ' +
        'Supports an optional `state` query filter (default: visible). ' +
        'Requires COMMERCE_EDIT_OWN (listing owner) or COMMERCE_EDIT_ALL (staff).',
    tags: ['Experience', 'Experience Media'],
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
