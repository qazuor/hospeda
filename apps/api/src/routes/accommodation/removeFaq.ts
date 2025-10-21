/**
 * DELETE /api/v1/public/accommodations/:id/faqs/:faqId
 * Remove an existing FAQ from an accommodation
 */

import { AccommodationFaqIdSchema, AccommodationIdSchema, DeleteResultSchema } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

// Initialize service once
const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Route definition using createCRUDRoute factory
 */
export const removeFaqRoute = createCRUDRoute({
    method: 'delete',
    path: '/{id}/faqs/{faqId}',
    summary: 'Remove FAQ from accommodation',
    description: 'Remove an FAQ from a specific accommodation',
    tags: ['Accommodations', 'FAQs'],
    requestParams: {
        id: AccommodationIdSchema,
        faqId: AccommodationFaqIdSchema
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const { id, faqId } = params;
        const actor = getActorFromContext(ctx);

        const result = await accommodationService.removeFaq(actor, {
            accommodationId: id as string,
            faqId: faqId as string
        });

        if (result.error) {
            throw new Error(result.error.message);
        }

        return {
            success: true,
            data: result.data
        };
    }
});
