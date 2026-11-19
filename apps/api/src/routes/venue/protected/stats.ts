/**
 * Owner-only advanced metrics for one venue listing (HOS-2261).
 *
 * @module routes/venue/protected/stats
 */

import { VenueListingStatsSchema, VenueStatsWindowSchema, VerticalEnum } from '@repo/schemas';
import { entityViewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';

import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

/**
 * GET /api/v1/protected/venues/{id}/stats
 *
 * Requires `view_advanced_stats` in the VENUE vertical. Listing access hides
 * non-owned ids as 404 before the service is called.
 */
export const protectedGetVenueStatsRoute = createProtectedRoute({
    method: 'get',
    emailUnverifiedOperation: 'READ_OWN',
    path: '/{id}/stats',
    listingAccess: {
        vertical: VerticalEnum.VENUE,
        operation: 'READ_OWN',
        idParam: 'id',
        capabilities: ['view_advanced_stats']
    },
    summary: 'Get advanced metrics for one venue listing',
    description:
        'Returns gap-filled daily views, click counts by channel and click rate for one owned venue.',
    tags: ['Venue'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestQuery: {
        window: VenueStatsWindowSchema.default('30d')
    },
    responseSchema: VenueListingStatsSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        _body: unknown,
        query: Record<string, unknown> = {}
    ) => {
        const result = await entityViewService.getStatsForVenue({
            actor: getActorFromContext(ctx),
            venueId: params.id as string,
            window: query.window as z.infer<typeof VenueStatsWindowSchema>
        });
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }
        return result.data;
    },
    options: {
        customRateLimit: { requests: 30, windowMs: 60_000 }
    }
});
