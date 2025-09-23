import { AccommodationIdSchema, AccommodationStatsSchema } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Handler for getting accommodation statistics
 * @param ctx - Hono context
 * @param params - Path parameters containing id
 * @returns Accommodation statistics data or null if not found
 */
const getStatsHandler = async (ctx: Context, params: Record<string, unknown>) => {
    // Get the ID from the path params
    const id = params.id as string;

    // Get actor from context (can be guest for public endpoint)
    const actor = getActorFromContext(ctx);

    // Get basic accommodation info first to get the name
    const accommodationResult = await accommodationService.getById(actor, id);

    if (accommodationResult.error || !accommodationResult.data) {
        // Return null if accommodation not found (schema is nullable)
        return null;
    }

    // Call the stats service
    const statsResult = await accommodationService.getStats(actor, { idOrSlug: id });

    if (statsResult.error) {
        throw new Error(statsResult.error.message);
    }

    // Return null if stats not found (schema is nullable)
    if (!statsResult.data) {
        return null;
    }

    // Transform service response to match AccommodationStatsSchema
    const statsResponse = {
        accommodation: {
            id,
            name: accommodationResult.data.name
        },
        stats: {
            total: statsResult.data.stats.total,
            totalFeatured: statsResult.data.stats.totalFeatured,
            averagePrice: statsResult.data.stats.averagePrice,
            averageRating: statsResult.data.stats.averageRating,
            totalByType: statsResult.data.stats.totalByType
        }
    };

    return statsResponse;
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
