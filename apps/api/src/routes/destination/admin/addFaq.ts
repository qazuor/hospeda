/**
 * POST /api/v1/admin/destinations/:id/faqs
 * Add a new FAQ to a destination - Admin endpoint
 */

import {
    type DestinationFaqAddInput,
    DestinationFaqSingleOutputSchema,
    DestinationIdSchema,
    FaqCreatePayloadSchema,
    type FaqCreatePayloadType
} from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * POST /api/v1/admin/destinations/:id/faqs
 * Add FAQ to destination - Admin endpoint
 *
 * Permission model (SPEC-177): service layer `destinationService.addFaq` calls
 * `_canUpdate(actor, destination)` which enforces `DESTINATION_UPDATE_ANY` OR
 * (`DESTINATION_UPDATE_OWN` + ownership). Route only requires admin-panel access
 * so users with appropriate destination update permissions can manage FAQs.
 */
export const adminAddDestinationFaqRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/faqs',
    summary: 'Add FAQ to destination (admin)',
    description:
        'Add a new frequently asked question to a destination. Requires admin-panel access; the service layer enforces UPDATE_ANY or (UPDATE_OWN + ownership).',
    tags: ['Destinations', 'FAQs'],
    requestParams: {
        id: DestinationIdSchema
    },
    requestBody: FaqCreatePayloadSchema,
    responseSchema: DestinationFaqSingleOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const input: DestinationFaqAddInput = {
            destinationId: params.id as string,
            faq: body as FaqCreatePayloadType
        };

        const result = await destinationService.addFaq(actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
