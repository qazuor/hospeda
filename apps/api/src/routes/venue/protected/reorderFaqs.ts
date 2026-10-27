/**
 * PUT /api/v1/protected/venues/:id/faqs/reorder
 * Reorder FAQs on a gastronomy listing (T-044 / SPEC-177 pattern)
 *
 * The caller supplies an explicit { faqId, displayOrder }[] array.
 * The service validates that all faqId values belong to the specified gastronomy.
 * Gated on VENUE_EDIT_OWN (listing owner) or VENUE_EDIT_ALL (staff).
 */

import { FaqReorderPayloadSchema, VenueFaqRemoveOutputSchema, VerticalEnum } from '@repo/schemas';
import { reorderVenueFaqs, ServiceError, VenueService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';

import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });

/**
 * Route handler — reorders FAQs on a gastronomy listing.
 *
 * NOTE: this route must be registered BEFORE /{id}/faqs/{faqId} so that Hono
 * does not treat "reorder" as a faqId param value. The index.ts registers it
 * first.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service instance
 * to pass to the standalone FAQ helper without requiring a public accessor.
 */
export const protectedReorderVenueFaqsRoute = createProtectedRoute({
    method: 'put',
    path: '/{id}/faqs/reorder',
    summary: 'Reorder FAQs on gastronomy listing',
    description: 'Sets a new display order for FAQs belonging to the given gastronomy listing',
    listingAccess: { vertical: VerticalEnum.VENUE, operation: 'EDIT', idParam: 'id' },
    tags: ['Gastronomy', 'Gastronomy FAQs'],
    protectedTag: false,
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: FaqReorderPayloadSchema,
    responseSchema: VenueFaqRemoveOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (venueService as unknown as { model: Parameters<typeof reorderVenueFaqs>[0] })
            .model;
        const result = await reorderVenueFaqs(model, actor, {
            gastronomyId: params.id as string,
            order: (body as { order: Array<{ faqId: string; displayOrder: number }> }).order
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data ?? { success: true };
    }
});
