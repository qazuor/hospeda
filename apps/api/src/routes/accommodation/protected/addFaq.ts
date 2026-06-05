/**
 * POST /api/v1/protected/accommodations/:id/faqs
 * Add a new FAQ to an accommodation
 */

import { EntitlementKey } from '@repo/billing';
import {
    type AccommodationFaqAddInput,
    AccommodationFaqSingleOutputSchema,
    AccommodationIdSchema,
    FaqCreatePayloadSchema,
    type FaqCreatePayloadType
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { requireEntitlement } from '../../../middlewares/entitlement';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

// Initialize service once
const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Route definition using createCRUDRoute factory
 * ✅ Full HTTP method support with request body validation
 */
export const addFaqRoute = createCRUDRoute({
    method: 'post',
    path: '/{id}/faqs',
    summary: 'Add FAQ to accommodation',
    description: 'Add a new frequently asked question to a specific accommodation',
    tags: ['Accommodations', 'FAQs'],
    requestParams: {
        id: AccommodationIdSchema
    },
    requestBody: FaqCreatePayloadSchema,
    responseSchema: AccommodationFaqSingleOutputSchema,
    handler: async (c: Context, params, body) => {
        // Get actor from context (authenticated user for protected endpoint)
        const actor = getActorFromContext(c);

        // Combine path param with body to form the service input
        const input: AccommodationFaqAddInput = {
            accommodationId: params.id as string,
            faq: body as FaqCreatePayloadType
        };

        // Add FAQ to accommodation
        const result = await accommodationService.addFaq(actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        // SPEC-145 T-004: FAQ mutation is accommodation content; same entitlement
        // gate as update/patch (EDIT_ACCOMMODATION_INFO — granted on all host plans).
        middlewares: [requireEntitlement(EntitlementKey.EDIT_ACCOMMODATION_INFO)]
    }
});

// Export handler for compatibility (not needed with createCRUDRoute)
export const addFaqHandler = null;
