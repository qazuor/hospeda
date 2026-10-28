/**
 * POST /api/v1/protected/venues/:id/faqs
 * Add a new FAQ to a venue listing (T-044)
 *
 * Gated on VENUE_EDIT_OWN (listing owner) or VENUE_EDIT_ALL (staff).
 * displayOrder is auto-assigned by addVenueFaq() as max(existing)+1.
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

import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });

/**
 * Route handler — adds a FAQ to the specified venue listing.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service instance
 * to pass to the standalone FAQ helper without requiring a public accessor.
 */
export const protectedAddVenueFaqRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/faqs',
    summary: 'Add FAQ to gastronomy listing',
    description: 'Adds a new frequently asked question to a gastronomy listing',
    listingAccess: { vertical: VerticalEnum.VENUE, operation: 'EDIT', idParam: 'id' },
    tags: ['Venue', 'Gastronomy FAQs'],
    protectedTag: false,
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
        const result = await addVenueFaq(model, actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
