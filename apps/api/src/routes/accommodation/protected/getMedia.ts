/**
 * GET /api/v1/protected/accommodations/:id/media
 * List photos in an accommodation gallery — Protected (owner-facing) endpoint (SPEC-204)
 *
 * Returns all non-deleted media rows for the given accommodation, ordered by
 * `sortOrder ASC`. Supports an optional `state` query filter (defaults to
 * `'visible'`). The service enforces UPDATE_OWN + ownership — the HOST owner
 * calling this endpoint passes that gate automatically.
 *
 * Note: calls `accommodationService.adminGetMedia`, which despite its name
 * enforces `_canUpdate(actor, accommodation)`. An owner with
 * `ACCOMMODATION_UPDATE_OWN` passes that gate. The name is NOT changed.
 */

import {
    AccommodationIdSchema,
    AccommodationMediaListOutputSchema,
    AccommodationMediaStateSchema
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * GET /api/v1/protected/accommodations/:id/media
 * List accommodation gallery photos — Protected endpoint
 *
 * Permission model (SPEC-204): service layer `accommodationService.adminGetMedia`
 * calls `_canUpdate(actor, accommodation)` which enforces
 * `ACCOMMODATION_UPDATE_ANY` OR (`ACCOMMODATION_UPDATE_OWN` + ownership).
 * An authenticated HOST owner passes the ownership branch.
 * No additional entitlement gate — read access requires only auth + ownership.
 */
export const protectedGetMediaRoute = createCRUDRoute({
    method: 'get',
    path: '/{id}/media',
    summary: 'List accommodation gallery photos (owner)',
    description:
        'Retrieve all media rows for an accommodation, ordered by sortOrder ASC. ' +
        'Supports an optional `state` query filter (default: visible). ' +
        'Requires authentication; the service layer enforces UPDATE_OWN + ownership.',
    tags: ['Accommodations', 'Media'],
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

        const result = await accommodationService.adminGetMedia(actor, {
            accommodationId,
            state
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { media: result.data?.media ?? [] };
    }
});
