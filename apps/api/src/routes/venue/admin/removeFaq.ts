/**
 * DELETE /api/v1/admin/venues/:id/faqs/:faqId
 * Remove an existing FAQ from a gastronomy listing — Admin endpoint.
 */
import { type VenueFaqRemoveInput, VenueFaqRemoveOutputSchema, VerticalEnum } from '@repo/schemas';
import { removeVenueFaq, ServiceError, VenueService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { runListingContentCall } from '../../../middlewares/listing-access';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/venues/:id/faqs/:faqId
 * Remove FAQ from gastronomy listing — Admin endpoint.
 *
 * Requires VENUE_EDIT_ALL permission. The service helper
 * `removeVenueFaq` enforces the same gate via `checkVenueCanEditFaqs`.
 */
export const adminRemoveVenueFaqRoute = createAdminRoute({
    method: 'delete',
    listingAccess: { vertical: VerticalEnum.VENUE, operation: 'EDIT', idParam: 'id' },
    path: '/{id}/faqs/{faqId}',
    summary: 'Remove FAQ from gastronomy listing (admin)',
    description: 'Removes a FAQ from a gastronomy listing. Requires VENUE_EDIT_ALL.',
    tags: ['Gastronomy', 'FAQs'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
        faqId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: VenueFaqRemoveOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        const input: VenueFaqRemoveInput = {
            gastronomyId: params.id as string,
            faqId: params.faqId as string
        };

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (venueService as unknown as { model: Parameters<typeof removeVenueFaq>[0] })
            .model;
        const result = await runListingContentCall({
            ctx,
            run: () => removeVenueFaq(model, actor, input)
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
