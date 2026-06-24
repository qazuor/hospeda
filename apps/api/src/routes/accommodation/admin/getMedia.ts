/**
 * GET /api/v1/admin/accommodations/:id/media
 * List photos in an accommodation gallery — Admin endpoint (SPEC-204)
 *
 * Returns all non-deleted media rows for the given accommodation, ordered by
 * `sortOrder ASC`. Supports an optional `state` query filter (defaults to
 * `'visible'`). The service enforces UPDATE_ANY or (UPDATE_OWN + ownership),
 * so a HOST with only VIEW_OWN sees only their own accommodation's gallery.
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
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * GET /api/v1/admin/accommodations/:id/media
 * List accommodation gallery photos — Admin endpoint
 *
 * Permission model (SPEC-204): service layer `accommodationService.adminGetMedia`
 * calls `_canUpdate(actor, accommodation)` which enforces
 * `ACCOMMODATION_UPDATE_ANY` OR (`ACCOMMODATION_UPDATE_OWN` + ownership).
 * Route only requires admin-panel access so HOSTs can list photos on their
 * own accommodations.
 */
export const adminGetMediaRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/media',
    summary: 'List accommodation gallery photos (admin)',
    description:
        'Retrieve all media rows for an accommodation, ordered by sortOrder ASC. ' +
        'Supports an optional `state` query filter (default: visible). ' +
        'Requires admin-panel access; the service layer enforces UPDATE_ANY or ' +
        '(UPDATE_OWN + ownership).',
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
    },
    options: {
        cacheTTL: 30,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
