/**
 * GET /api/v1/public/accommodations/:id/faqs
 * Get all FAQs for an accommodation
 */

import { AccommodationFaqListOutputSchema } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
import type { Context } from 'hono';
import { createGuestActor } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createSimpleRoute } from '../../utils/route-factory';

// Initialize service once
const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Handler for getting all FAQs for an accommodation
 * Simplified handler that focuses on business logic
 *
 * @param c - Hono context
 * @returns FAQs list data
 */
const getFaqsHandler = async (c: Context) => {
    const { id } = c.req.param();

    // Create guest actor for public endpoint
    const actor = createGuestActor();

    // Validate required parameters
    if (!id) {
        throw new Error('VALIDATION_ERROR: accommodation ID is required');
    }

    // Get FAQs for accommodation
    const result = await accommodationService.getFaqs(actor, {
        accommodationId: id
    });

    if (result.error) {
        throw new Error(`${result.error.code}: ${result.error.message}`);
    }

    return {
        faqs: result.data.faqs || []
    };
};

/**
 * Route definition using createSimpleRoute factory
 * ✅ 80% less boilerplate than manual createRoute
 */
export const getFaqsRoute = createSimpleRoute({
    method: 'get',
    path: '/{id}/faqs',
    summary: 'Get accommodation FAQs',
    description: 'Retrieve all frequently asked questions for a specific accommodation',
    tags: ['Accommodations', 'FAQs'],
    responseSchema: AccommodationFaqListOutputSchema,
    handler: getFaqsHandler
});

// Export handler for use in route registration (compatibility)
export { getFaqsHandler };
