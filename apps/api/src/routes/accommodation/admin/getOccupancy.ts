/**
 * GET /api/v1/admin/accommodations/:id/occupancy
 *
 * Staff occupancy calendar read (HOS-43 Phase 1, spec section 6).
 *
 * Gated by `ACCOMMODATION_OCCUPANCY_VIEW` via the admin route's
 * `requiredPermissions` (enforced by `adminAuthMiddleware`), re-checked
 * inside `getAdminOccupancyForAccommodation` as defense-in-depth. No
 * ownership scoping — staff may view ANY accommodation's calendar.
 */
import {
    AccommodationIdSchema,
    AccommodationOccupancySchema,
    OccupancyDateSchema,
    PermissionEnum
} from '@repo/schemas';
import { getAdminOccupancyForAccommodation } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory';
import { resolveOccupancyRangeQuery } from '../occupancy-range.util';

const AdminOccupancyResponseSchema = z.object({
    occupancy: z.array(AccommodationOccupancySchema)
});

/**
 * GET /api/v1/admin/accommodations/:id/occupancy
 *
 * Returns the full occupancy row set for any accommodation. Supports an
 * optional half-open `?from&to` range; omit both to fetch every row.
 */
export const adminGetOccupancyRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/occupancy',
    summary: 'Get accommodation occupancy calendar (admin)',
    description:
        'Returns the full occupancy row set for any accommodation. Requires ' +
        'ACCOMMODATION_OCCUPANCY_VIEW. Supports an optional half-open ?from&to range; ' +
        'omit both to fetch every row.',
    tags: ['Accommodations'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_OCCUPANCY_VIEW],
    requestParams: {
        id: AccommodationIdSchema
    },
    requestQuery: {
        from: OccupancyDateSchema.optional(),
        to: OccupancyDateSchema.optional()
    },
    responseSchema: AdminOccupancyResponseSchema,
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

        const occupancy = await getAdminOccupancyForAccommodation({
            actor,
            accommodationId,
            from,
            to
        });

        return { occupancy };
    }
});
