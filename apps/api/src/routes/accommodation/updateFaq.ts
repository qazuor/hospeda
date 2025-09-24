/**
 * PUT /api/v1/public/accommodations/:id/faqs/:faqId
 * Update an existing FAQ for an accommodation
 * ✅ Migrated to use createCRUDRoute (Route Factory)
 */

import { AccommodationFaqAddInputSchema } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

// Local schemas for API
const FaqParamsSchema = z.object({
    id: z
        .string()
        .uuid('Invalid accommodation ID format')
        .openapi({
            param: { name: 'id', in: 'path' },
            example: 'acc_1234567890'
        }),
    faqId: z
        .string()
        .uuid('Invalid FAQ ID format')
        .openapi({
            param: { name: 'faqId', in: 'path' },
            example: 'faq_1234567890'
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
const faqUpdateSchema = faqCreateSchema.partial().openapi('FaqUpdate');

// Initialize service once
const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Route definition using createCRUDRoute factory
 * ✅ Full HTTP method support with request body validation
 */
export const updateFaqRoute = createCRUDRoute({
    method: 'put',
    path: '/{id}/faqs/{faqId}',
    summary: 'Update accommodation FAQ',
    description: 'Update an existing frequently asked question for a specific accommodation',
    tags: ['Accommodations', 'FAQs'],
    requestParams: {
        id: FaqParamsSchema.shape.id,
        faqId: FaqParamsSchema.shape.faqId
    },
    requestBody: faqUpdateSchema,
    responseSchema: z
        .object({
            faq: faqResponseSchema
        })
        .openapi('UpdateFaqResponse'),
    handler: async (c, params, body) => {
        // Get actor from context (authenticated user for protected endpoint)
        const actor = getActorFromContext(c);

        // First, get the existing FAQ to merge with updates
        const existingResult = await accommodationService.getFaqs(actor, {
            accommodationId: params.id as string
        });

        if (existingResult.error) {
            throw new Error(`${existingResult.error.code}: ${existingResult.error.message}`);
        }

        // Find the specific FAQ
        const existingFaq = existingResult.data.faqs?.find((faq) => faq.id === params.faqId);
        if (!existingFaq) {
            throw new Error('NOT_FOUND: FAQ not found');
        }

        const updateData = body as z.infer<typeof faqUpdateSchema>;

        // Update FAQ for accommodation with merged data
        const result = await accommodationService.updateFaq(actor, {
            accommodationId: params.id as string,
            faqId: params.faqId as string,
            faq: {
                question: updateData.question ?? existingFaq.question,
                answer: updateData.answer ?? existingFaq.answer,
                category: updateData.category ?? existingFaq.category
            }
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
export const updateFaqHandler = null;
