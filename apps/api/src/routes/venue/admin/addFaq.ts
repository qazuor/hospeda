/**
 * POST /api/v1/admin/venues/:id/faqs
 * Add a new FAQ to a venue listing — Admin endpoint.
 */
import {
    FaqWithChannelVisibilityCreatePayloadSchema,
    type FaqWithChannelVisibilityCreatePayloadType,
    type VenueFaqAddInput,
    VenueFaqSingleOutputSchema,
    VerticalEnum
} from '@repo/schemas';
import { addVenueFaq, ServiceError, VenueService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { runListingContentCall } from '../../../middlewares/listing-access';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });

/**
 * POST /api/v1/admin/venues/:id/faqs
 * Add FAQ to venue listing — Admin endpoint.
 *
 * Requires VENUE_EDIT_ALL permission. The service helper
 * `addVenueFaq` enforces the same gate via `checkVenueCanEditFaqs`.
 */
export const adminAddVenueFaqRoute = createAdminRoute({
    method: 'post',
    listingAccess: { vertical: VerticalEnum.VENUE, operation: 'EDIT', idParam: 'id' },
    path: '/{id}/faqs',
    summary: 'Add FAQ to venue listing (admin)',
    description:
        'Adds a new frequently asked question to a venue listing. Requires VENUE_EDIT_ALL.',
    tags: ['Venue', 'FAQs'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: FaqWithChannelVisibilityCreatePayloadSchema,
    responseSchema: VenueFaqSingleOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const input: VenueFaqAddInput = {
            venueId: params.id as string,
            faq: body as FaqWithChannelVisibilityCreatePayloadType
        };

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (venueService as unknown as { model: Parameters<typeof addVenueFaq>[0] })
            .model;
        const result = await runListingContentCall({
            ctx,
            run: () => addVenueFaq(model, actor, input)
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
