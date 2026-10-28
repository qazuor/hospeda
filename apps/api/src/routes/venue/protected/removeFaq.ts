/**
 * DELETE /api/v1/protected/venues/:id/faqs/:faqId
 * Remove (soft-delete) a FAQ from a venue listing (T-044)
 *
 * Gated on VENUE_EDIT_OWN (listing owner) or VENUE_EDIT_ALL (staff).
 * The FAQ must belong to the specified venue (enforced inside removeVenueFaq).
 */

import { VenueFaqRemoveOutputSchema, VerticalEnum } from '@repo/schemas';
import { removeVenueFaq, ServiceError, VenueService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';

import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });

/**
 * Route handler — soft-deletes a specific FAQ from a venue listing.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service instance
 * to pass to the standalone FAQ helper without requiring a public accessor.
 */
export const protectedRemoveVenueFaqRoute = createProtectedRoute({
    method: 'delete',
    path: '/{id}/faqs/{faqId}',
    summary: 'Remove FAQ from venue listing',
    description: 'Soft-deletes a FAQ from a venue listing',
    listingAccess: { vertical: VerticalEnum.VENUE, operation: 'EDIT', idParam: 'id' },
    tags: ['Venue', 'Gastronomy FAQs'],
    protectedTag: false,
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
        faqId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: VenueFaqRemoveOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (venueService as unknown as { model: Parameters<typeof removeVenueFaq>[0] })
            .model;
        const result = await removeVenueFaq(model, actor, {
            venueId: params.id as string,
            faqId: params.faqId as string
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data ?? { success: true };
    }
});
