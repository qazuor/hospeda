/**
 * POST /api/v1/public/accommodations/:id/faqs
 * Add a new FAQ to an accommodation
 * ✅ Migrated to use createCRUDRoute (Route Factory)
 */

import { z } from '@hono/zod-openapi';
import { AccommodationFaqAddInputSchema } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

// Local schemas for API
const ParamsSchema = z.object({
    id: z
        .string()
        .uuid('Invalid accommodation ID format')
        .openapi({
            param: { name: 'id', in: 'path' },
            example: 'acc_1234567890'
        })
});

const faqResponseSchema = z
    .object({
        id: z.string(),
        question: z.string(),
        answer: z.string(),
        order: z.number(),
        createdAt: z.string(),
        updatedAt: z.string()
    })
    .openapi('FaqResponse');

const faqCreateSchema = z
    .object(AccommodationFaqAddInputSchema.shape.faq.shape)
    .openapi('FaqCreate');

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
        id: ParamsSchema.shape.id
    },
    requestBody: faqCreateSchema,
    responseSchema: z
        .object({
            faq: faqResponseSchema
        })
        .openapi('AddFaqResponse'),
    handler: async (c, params, body) => {
        // Get actor from context (authenticated user for protected endpoint)
        const actor = getActorFromContext(c);

        // Add FAQ to accommodation
        const result = await accommodationService.addFaq(actor, {
            accommodationId: params.id as string,
            faq: body as z.infer<typeof faqCreateSchema>
        });

        if (result.error) {
            throw new Error(`${result.error.code}: ${result.error.message}`);
        }

        return {
            faq: result.data.faq
        };
    }
});

// Export handler for compatibility (not needed with createCRUDRoute)
export const addFaqHandler = null;
