/**
 * POST /api/v1/protected/accommodations/:id/faqs
 * Add a new FAQ to an accommodation
 */

import {
    type AccommodationFaqAddInput,
    AccommodationFaqSingleOutputSchema,
    AccommodationIdSchema,
    FaqWithChannelVisibilityCreatePayloadSchema,
    type FaqWithChannelVisibilityCreatePayloadType,
    VerticalEnum
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';

import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

// Initialize service once
const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Route definition using createCRUDRoute factory
 * ✅ Full HTTP method support with request body validation
 */
export const addFaqRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/faqs',
    summary: 'Add FAQ to accommodation',
    description: 'Add a new frequently asked question to a specific accommodation',
    listingAccess: { vertical: VerticalEnum.ACCOMMODATION, operation: 'EDIT', idParam: 'id' },
    tags: ['Accommodations', 'FAQs'],
    protectedTag: false,
    requestParams: {
        id: AccommodationIdSchema
    },
    requestBody: FaqWithChannelVisibilityCreatePayloadSchema,
    responseSchema: AccommodationFaqSingleOutputSchema,
    handler: async (c: Context, params, body) => {
        // Get actor from context (authenticated user for protected endpoint)
        const actor = getActorFromContext(c);

        // Combine path param with body to form the service input
        const input: AccommodationFaqAddInput = {
            accommodationId: params.id as string,
            faq: body as FaqWithChannelVisibilityCreatePayloadType
        };

        // Add FAQ to accommodation
        const result = await accommodationService.addFaq(actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        // HOS-1352: transitional until V3 (HOS-1357), see PR — removed FAQ entitlement gate.
    }
});

// Export handler for compatibility (not needed with createCRUDRoute)
export const addFaqHandler = null;
