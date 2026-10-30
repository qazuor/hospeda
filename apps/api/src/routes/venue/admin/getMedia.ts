/**
 * GET /api/v1/admin/venues/:id/media
 * List photos in a venue listing gallery — Admin endpoint (HOS-372).
 *
 * Returns all non-deleted media rows for the given listing, ordered by
 * `sortOrder ASC`. Supports an optional `state` query filter (defaults to
 * `'visible'`).
 */
import { PermissionEnum, VenueMediaListOutputSchema, VenueMediaStateSchema } from '@repo/schemas';
import { getVenueMedia, ServiceError, VenueService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });

/**
 * GET /api/v1/admin/venues/:id/media
 * List venue listing gallery photos — Admin endpoint.
 *
 * Requires VENUE_EDIT_ALL permission (mirrors the internal
 * `checkVenueCanEditMedia` gate — media management has no separate
 * broader view-only permission). The service helper `getVenueMedia`
 * enforces the same gate.
 */
export const adminGetVenueMediaRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/media',
    summary: 'List venue listing gallery photos (admin)',
    description:
        'Retrieves all media rows for a venue listing, ordered by sortOrder ASC. ' +
        'Supports an optional `state` query filter (default: visible). Requires VENUE_EDIT_ALL.',
    tags: ['Venue', 'Media'],
    anyOfPermissions: [[PermissionEnum.VENUE_EDIT_ALL]],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestQuery: {
        state: VenueMediaStateSchema.optional()
    },
    responseSchema: VenueMediaListOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        // Extract optional state query param.
        const rawState = ctx.req.query('state');
        const stateParsed = rawState
            ? VenueMediaStateSchema.safeParse(rawState)
            : { success: false as const };
        const state = stateParsed.success ? stateParsed.data : undefined;

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (venueService as unknown as { model: Parameters<typeof getVenueMedia>[0] })
            .model;
        const result = await getVenueMedia(model, actor, {
            venueId: params.id as string,
            state
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { media: result.data?.media ?? [] };
    }
});
