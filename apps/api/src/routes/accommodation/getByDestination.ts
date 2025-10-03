/**
 * GET /api/v1/public/accommodations/destination/:destinationId
 * Get accommodations by destination
 * ✅ Migrated to use createSimpleRoute (Route Factory)
 */

import { AccommodationListWrapperSchema } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
import type { Context } from 'hono';
import { createGuestActor } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createSimpleRoute } from '../../utils/route-factory';

// Initialize service once
const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Handler for getting accommodations by destination
 * Simplified handler that focuses on business logic
 *
 * @param c - Hono context
 * @returns Accommodations list data
 */
const getByDestinationHandler = async (c: Context) => {
    const { destinationId } = c.req.param();

    // Create guest actor for public endpoint
    const actor = createGuestActor();

    // Validate required parameters
    if (!destinationId) {
        throw new Error('VALIDATION_ERROR: destination ID is required');
    }

    // Get accommodations by destination
    const result = await accommodationService.getByDestination(actor, {
        destinationId,
        page: 1,
        pageSize: 20
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
export const getByDestinationRoute = createSimpleRoute({
    method: 'get',
    path: '/destination/{destinationId}',
    summary: 'Get accommodations by destination',
    description: 'Retrieve all accommodations for a specific destination',
    tags: ['Accommodations'],
    responseSchema: AccommodationListWrapperSchema,
    handler: getByDestinationHandler
});

// Export handler for use in route registration (compatibility)
export { getByDestinationHandler };
