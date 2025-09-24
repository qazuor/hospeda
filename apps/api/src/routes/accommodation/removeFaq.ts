/**
 * DELETE /api/v1/public/accommodations/:id/faqs/:faqId
 * Remove an FAQ from an accommodation
 * ✅ Migrated to use createCRUDRoute (Route Factory)
 */

import { z } from '@hono/zod-openapi';
import { AccommodationService } from '@repo/service-core';
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

const successResponseSchema = z
    .object({
        success: z.boolean()
    })
    .openapi('SuccessResponse');

// Initialize service once
const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Route definition using createCRUDRoute factory
 * ✅ Full HTTP method support including DELETE
 */
export const removeFaqRoute = createCRUDRoute({
    method: 'delete',
    path: '/{id}/faqs/{faqId}',
    summary: 'Remove accommodation FAQ',
    description: 'Remove a frequently asked question from a specific accommodation',
    tags: ['Accommodations', 'FAQs'],
    requestParams: {
        id: FaqParamsSchema.shape.id,
        faqId: FaqParamsSchema.shape.faqId
    },
    responseSchema: successResponseSchema,
    handler: async (c, params) => {
        // Get actor from context (authenticated user for protected endpoint)
        const actor = getActorFromContext(c);

        // Remove FAQ from accommodation
        const result = await accommodationService.removeFaq(actor, {
            accommodationId: params.id as string,
            faqId: params.faqId as string
        });

        if (result.error) {
            throw new Error(`${result.error.code}: ${result.error.message}`);
        }

        return {
            success: true
        };
    }
});

// Export handler for compatibility (not needed with createCRUDRoute)
export const removeFaqHandler = null;
