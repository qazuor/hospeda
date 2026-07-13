/**
 * GET /api/v1/protected/accommodations/:id/occupancy
 *
 * Owner-facing occupancy calendar read (HOS-43 Phase 1, spec section 6).
 *
 * No declarative `ownership:` config — ownership is enforced inline inside
 * `getOwnerOccupancyForAccommodation` (mirrors `featured-toggle.ts`'s
 * pattern), which also grants the `ACCOMMODATION_UPDATE_ANY` staff bypass.
 * No `CAN_USE_CALENDAR` gate on reads (see that function's doc).
 */
import {
    AccommodationIdSchema,
    AccommodationOccupancySchema,
    OccupancyDateSchema
} from '@repo/schemas';
import { getOwnerOccupancyForAccommodation } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';
import { resolveOccupancyRangeQuery } from '../occupancy-range.util';

const OwnerOccupancyResponseSchema = z.object({
    occupancy: z.array(AccommodationOccupancySchema)
});

/**
 * GET /api/v1/protected/accommodations/:id/occupancy
 *
 * Returns the full occupancy row set (all fields, including `note`) for the
 * requesting owner's accommodation. Supports an optional half-open
 * `?from&to` range (both required together); omit both to fetch every row.
 */
export const protectedGetOccupancyRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/occupancy',
    summary: 'Get accommodation occupancy calendar (owner)',
    description:
        'Returns the full occupancy row set for an accommodation the actor owns ' +
        '(or holds ACCOMMODATION_UPDATE_ANY for). Supports an optional half-open ' +
        '?from&to range; omit both to fetch every row.',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    requestQuery: {
        from: OccupancyDateSchema.optional(),
        to: OccupancyDateSchema.optional()
    },
    responseSchema: OwnerOccupancyResponseSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;
        const { from, to } = resolveOccupancyRangeQuery({
            from: query?.from as string | undefined,
            to: query?.to as string | undefined
        });

        const occupancy = await getOwnerOccupancyForAccommodation({
            actor,
            accommodationId,
            from,
            to
        });

        return { occupancy };
    }
});
