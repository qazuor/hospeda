import { AccommodationIdSchema, AccommodationStatsSchema } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { createGuestActor } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Handler for getting accommodation statistics
 * @param ctx - Hono context
 * @param params - Path parameters containing id
 * @returns Accommodation statistics data or null if not found
 */
const getStatsHandler = async (_ctx: Context, params: Record<string, unknown>) => {
    // Get the ID from the path params
    const id = params.id as string;

    // HOS-353: resolve visibility against a GUEST actor, never the caller — for BOTH
    // service calls below. This route lives under the `/api/v1/public/accommodations`
    // prefix, whose cache key carries no actor and which is consulted before auth, so
    // a privileged reader's 200 would be replayed to every anonymous visitor for the
    // TTL. Privileged reads live on the protected and admin tiers.

    // Get basic accommodation info first to get the name
    const accommodationResult = await accommodationService.getById(createGuestActor(), id);

    if (accommodationResult.error || !accommodationResult.data) {
        // Return null if accommodation not found (schema is nullable)
        return null;
    }

    // Call the stats service
    const statsResult = await accommodationService.getStats(createGuestActor(), {
        idOrSlug: id
    });

    if (statsResult.error) {
        throw new HTTPException(500, {
            message: statsResult.error.message
        });
    }

    // Return null if stats not found (schema is nullable)
    if (!statsResult.data) {
        return null;
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
    responseSchema: AccommodationStatsSchema.nullable(),
    handler: getStatsHandler,
    options: {
        skipAuth: true, // Public endpoint
        skipValidation: true, // Skip header validation for public endpoint
        cacheTTL: 300, // Cache for 5 minutes
        customRateLimit: { requests: 100, windowMs: 60000 } // 100 requests per minute
    }
});
