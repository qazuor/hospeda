/**
 * PUT /api/v1/admin/venues/:id/faqs/:faqId
 * Update an existing FAQ in a gastronomy listing — Admin endpoint.
 */
import {
    FaqWithChannelVisibilityUpdatePayloadSchema,
    type FaqWithChannelVisibilityUpdatePayloadType,
    VenueFaqSingleOutputSchema,
    type VenueFaqUpdateInput,
    VerticalEnum
} from '@repo/schemas';
import { ServiceError, updateVenueFaq, VenueService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { runListingContentCall } from '../../../middlewares/listing-access';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/venues/:id/faqs/:faqId
 * Update FAQ in gastronomy listing — Admin endpoint.
 *
 * Requires VENUE_EDIT_ALL permission. The service helper
 * `updateVenueFaq` enforces the same gate via `checkVenueCanEditFaqs`.
 */
export const adminUpdateVenueFaqRoute = createAdminRoute({
    method: 'put',
    listingAccess: { vertical: VerticalEnum.VENUE, operation: 'EDIT', idParam: 'id' },
    path: '/{id}/faqs/{faqId}',
    summary: 'Update FAQ in gastronomy listing (admin)',
    description: 'Updates an existing FAQ in a gastronomy listing. Requires VENUE_EDIT_ALL.',
    tags: ['Venue', 'FAQs'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
        faqId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: FaqWithChannelVisibilityUpdatePayloadSchema,
    responseSchema: VenueFaqSingleOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const input: VenueFaqUpdateInput = {
            venueId: params.id as string,
            faqId: params.faqId as string,
            faq: body as FaqWithChannelVisibilityUpdatePayloadType
        };

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (venueService as unknown as { model: Parameters<typeof updateVenueFaq>[0] })
            .model;
        const result = await runListingContentCall({
            ctx,
            run: () => updateVenueFaq(model, actor, input)
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
