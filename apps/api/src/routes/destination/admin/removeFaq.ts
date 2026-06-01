/**
 * DELETE /api/v1/admin/destinations/:id/faqs/:faqId
 * Remove an existing FAQ from a destination - Admin endpoint
 */

import { DeleteResultSchema, DestinationFaqIdSchema, DestinationIdSchema } from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/destinations/:id/faqs/:faqId
 * Remove FAQ from destination - Admin endpoint
 *
 * Permission model (SPEC-177): service layer `destinationService.removeFaq` calls
 * `_canUpdate(actor, destination)` which enforces UPDATE_ANY or (UPDATE_OWN + ownership).
 * Route only requires admin-panel access.
 */
export const adminRemoveDestinationFaqRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/faqs/{faqId}',
    summary: 'Remove FAQ from destination (admin)',
    description:
        'Remove a FAQ from a destination. Requires admin-panel access; the service layer enforces UPDATE_ANY or (UPDATE_OWN + ownership).',
    tags: ['Destinations', 'FAQs'],
    requestParams: {
        id: DestinationIdSchema,
        faqId: DestinationFaqIdSchema
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        const result = await destinationService.removeFaq(actor, {
            destinationId: params.id as string,
            faqId: params.faqId as string
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            success: true,
            data: result.data
        };
    }
});
