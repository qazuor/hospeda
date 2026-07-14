/**
 * GET /api/v1/public/accommodations/:id/occupancy
 *
 * Public occupancy calendar read (HOS-43 Phase 1, spec section 6).
 *
 * No authentication. Returns ONLY the minimal public-safe projection — the
 * gating happens entirely in `getPublicOccupancyForAccommodation`, which
 * strips `note`/`createdById`/`id`/`accommodationId`/`externalEventId`/
 * timestamps before this route ever sees a row. No `ownership:` config and
 * no entitlement gate — a public read never requires `CAN_USE_CALENDAR`.
 */
import {
    AccommodationIdSchema,
    OccupancyDateSchema,
    OccupancySourceEnumSchema
} from '@repo/schemas';
import { getPublicOccupancyForAccommodation } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { createPublicRoute } from '../../../utils/route-factory';
import { resolveOccupancyRangeQuery } from '../occupancy-range.util';

const PublicOccupancyEntrySchema = z.object({
    date: OccupancyDateSchema,
    isBlocked: z.boolean(),
    source: OccupancySourceEnumSchema
});

const PublicOccupancyResponseSchema = z.object({
    occupancy: z.array(PublicOccupancyEntrySchema)
});

/**
 * GET /api/v1/public/accommodations/:id/occupancy
 *
 * Returns the accommodation's blocked days. Supports an optional half-open
 * `?from&to` range (both required together); omit both to fetch every row.
 */
export const publicGetOccupancyRoute = createPublicRoute({
    method: 'get',
    path: '/{id}/occupancy',
    summary: 'Get accommodation occupancy calendar (public)',
    description:
        "Returns the accommodation's blocked days as a minimal public projection " +
        '({ date, isBlocked, source }) — no internal notes or actor ids. ' +
        'Supports an optional half-open ?from&to range; omit both to fetch every row.',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    requestQuery: {
        from: OccupancyDateSchema.optional(),
        to: OccupancyDateSchema.optional()
    },
    responseSchema: PublicOccupancyResponseSchema,
    handler: async (
        _ctx: Context,
        params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
        const accommodationId = params.id as string;
        const { from, to } = resolveOccupancyRangeQuery({
            from: query?.from as string | undefined,
            to: query?.to as string | undefined
        });

        const occupancy = await getPublicOccupancyForAccommodation({
            accommodationId,
            from,
            to
        });

        return { occupancy };
    }
});
