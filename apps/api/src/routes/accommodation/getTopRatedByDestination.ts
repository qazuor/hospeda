/**
 * GET /api/v1/public/accommodations/top-rated
 * Get top-rated accommodations by destination
 * ✅ Migrated to use createSimpleRoute (Route Factory)
 */

import { AccommodationService } from '@repo/service-core';
import type { Context } from 'hono';
import { createGuestActor } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createSimpleRoute } from '../../utils/route-factory';
import { topRatedAccommodationsSchema } from './schemas';

// Initialize service once
const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Handler for getting top-rated accommodations by destination
 * Simplified handler that focuses on business logic
 *
 * @param c - Hono context
 * @returns Top-rated accommodations list data
 */
const getTopRatedByDestinationHandler = async (c: Context) => {
    const { destinationId } = c.req.param();

    // Create guest actor for public endpoint
    const actor = createGuestActor();

    if (!destinationId) {
        throw new Error('VALIDATION_ERROR: destination ID is required');
    }

    // Get top-rated accommodations by destination (provide required defaults)
    const result = await accommodationService.getTopRatedByDestination(actor, {
        destinationId,
        limit: 10,
        onlyFeatured: false
    });

    if (result.error) {
        throw new Error(`${result.error.code}: ${result.error.message}`);
    }

    return result.data || [];
};

/**
 * Route definition using createSimpleRoute factory
 * ✅ 80% less boilerplate than manual createRoute
 */
export const getTopRatedByDestinationRoute = createSimpleRoute({
    method: 'get',
    path: '/destination/{destinationId}/top-rated',
    summary: 'Get top-rated accommodations by destination',
    description: 'Retrieve top-rated accommodations for a specific destination',
    tags: ['Accommodations'],
    responseSchema: topRatedAccommodationsSchema.openapi('TopRatedAccommodationsResponse'),
    handler: getTopRatedByDestinationHandler
});

// Export handler for use in route registration (compatibility)
export { getTopRatedByDestinationHandler };
