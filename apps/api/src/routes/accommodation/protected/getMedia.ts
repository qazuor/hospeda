/**
 * GET /api/v1/protected/accommodations/:id/media
 * List photos in an accommodation gallery — Protected (owner-facing) endpoint (SPEC-204)
 *
 * Returns all non-deleted media rows for the given accommodation, ordered by
 * `sortOrder ASC`. Owners with UPDATE_OWN and staff with VIEW_ALL may read;
 * foreign rows answer 404.
 */

import {
    AccommodationIdSchema,
    AccommodationMediaListOutputSchema,
    AccommodationMediaStateSchema
} from '@repo/schemas';
import { getAccommodationMediaForReader } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

/**
 * GET /api/v1/protected/accommodations/:id/media
 * List accommodation gallery photos — Protected endpoint
 *
 * Permission model: owners with `ACCOMMODATION_UPDATE_OWN` and staff with
 * `ACCOMMODATION_VIEW_ALL` may read; a foreign uninspected row answers 404.
 * No additional entitlement gate — read access requires only auth + ownership.
 */
export const protectedGetMediaRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/media',
    summary: 'List accommodation gallery photos (owner)',
    description:
        'Retrieve all media rows for an accommodation, ordered by sortOrder ASC. ' +
        'Supports an optional `state` query filter (default: visible). ' +
        'Requires authentication and ownership with UPDATE_OWN or inspection with ACCOMMODATION_VIEW_ALL; foreign rows answer 404.',
    tags: ['Accommodations', 'Media'],
    protectedTag: false,
    requestParams: {
        id: AccommodationIdSchema
    },
    requestQuery: {
        state: AccommodationMediaStateSchema.optional()
    },
    responseSchema: AccommodationMediaListOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;

        // Extract optional state query param.
        const rawState = ctx.req.query('state');
        const stateParsed = rawState
            ? AccommodationMediaStateSchema.safeParse(rawState)
            : { success: false as const };
        const state = stateParsed.success ? stateParsed.data : undefined;

        const media = await getAccommodationMediaForReader({
            actor,
            accommodationId,
            state
        });
        return { media };
    }
});
