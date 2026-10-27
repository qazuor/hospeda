import { AccommodationIdSchema, AccommodationStatsSchema, ServiceErrorCode } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { createGuestActor } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Handler for getting accommodation statistics
 * @param _ctx - Hono context. Unused: this handler must not read the request
 *   actor (HOS-353) — the response is stored under an actorless public cache key.
 * @param params - Path parameters containing id
 * @returns Accommodation statistics data
 * @throws {ServiceError} NOT_FOUND when the accommodation does not exist or is hidden (HOS-1902)
 */
const getStatsHandler = async (_ctx: Context, params: Record<string, unknown>) => {
    // Get the ID from the path params
    const id = params.id as string;

    // HOS-353: resolve visibility against a GUEST actor, never the caller — for BOTH
    // service calls below. This route lives under the `/api/v1/public/accommodations`
    // prefix, whose cache key carries no actor and which is consulted before auth, so
    // a privileged reader's 200 would be replayed to every anonymous visitor for the
    // TTL. Privileged reads live on the protected and admin tiers.

    // Visibility pre-check, not a name lookup: nothing reads `data` beyond the
    // existence test. `getStats` gates through `_canView` too, so this call is
    // what turns an unknown or hidden listing into a 404 (same as `/summary`)
    // instead of the 500 the `statsResult.error` branch below would raise
    // (HOS-1902).
    const accommodationResult = await accommodationService.getById(createGuestActor(), id);

    if (accommodationResult.error) {
        throw new ServiceError(accommodationResult.error.code, accommodationResult.error.message);
    }

    if (!accommodationResult.data) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Accommodation not found: ${id}`);
    }

    // Call the stats service
    const statsResult = await accommodationService.getStats(createGuestActor(), {
        idOrSlug: id
    });

    if (statsResult.error) {
        throw new ServiceError(statsResult.error.code, statsResult.error.message);
    }

    if (!statsResult.data) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Accommodation not found: ${id}`);
    }

    // Schema is flat (AccommodationStatsSchema = { total, totalFeatured, ... }).
    // The service wraps in { stats }, so unwrap before returning.
    return statsResult.data.stats;
};

/**
 * GET /accommodations/:id/stats
 * Public endpoint to get accommodation statistics
 */
export const getStatsRoute = createCRUDRoute({
    method: 'get',
    path: '/{id}/stats',
    summary: 'Get accommodation statistics',
    description:
        'Retrieve statistics for a specific accommodation including reviews count, average rating, and detailed rating breakdown',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: AccommodationStatsSchema,
    handler: getStatsHandler,
    options: {
        skipAuth: true, // Public endpoint
        skipValidation: true, // Skip header validation for public endpoint
        customRateLimit: { requests: 100, windowMs: 60000 } // 100 requests per minute
    }
});
