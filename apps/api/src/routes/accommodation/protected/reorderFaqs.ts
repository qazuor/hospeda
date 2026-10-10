/**
 * PUT /api/v1/protected/accommodations/:id/faqs/reorder
 * Reorder FAQs on an accommodation — Protected (owner-facing) endpoint
 *
 * The caller supplies an explicit { faqId, displayOrder }[] array. The
 * service validates that all faqId values belong to the specified
 * accommodation before applying the new order in a single transaction.
 *
 * IMPORTANT: Must be mounted BEFORE `/{id}/faqs/{faqId}` so that Hono does
 * not resolve the literal path segment "reorder" as a `faqId` UUID param.
 * index.ts registers it first.
 *
 * NOTE: the admin tier uses PATCH for the equivalent route (preexisting
 * inconsistency between tiers). This protected route intentionally mirrors
 * gastronomy/experience protected FAQ reorder (PUT), not the admin tier.
 * The listing access resolver requires the EDIT capability on the owner.
 */

import {
    AccommodationIdSchema,
    type FaqReorderPayload,
    FaqReorderPayloadSchema,
    SuccessSchema,
    VerticalEnum
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';

import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

// Initialize service once
const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Route definition using createCRUDRoute factory
 *
 * Permission model (SPEC-177): service layer `accommodationService.reorderFaqs`
 * calls `_canUpdate(actor, accommodation)` which enforces
 * `ACCOMMODATION_UPDATE_ANY` OR (`ACCOMMODATION_UPDATE_OWN` + ownership).
 * The listing access resolver requires the EDIT capability on the owner.
 */
export const protectedReorderFaqsRoute = createProtectedRoute({
    method: 'put',
    path: '/{id}/faqs/reorder',
    summary: 'Reorder FAQs on accommodation (owner)',
    description:
        'Set the displayOrder for a set of FAQs belonging to an accommodation. All faqId ' +
        'values must belong to the given accommodation. Requires EDIT_ACCOMMODATION_INFO ' +
        'entitlement; the service layer enforces UPDATE_OWN + ownership.',
    listingAccess: { vertical: VerticalEnum.ACCOMMODATION, operation: 'EDIT', idParam: 'id' },
    tags: ['Accommodations', 'FAQs'],
    protectedTag: false,
    requestParams: {
        id: AccommodationIdSchema
    },
    requestBody: FaqReorderPayloadSchema,
    responseSchema: SuccessSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const result = await accommodationService.reorderFaqs(actor, {
            accommodationId: params.id as string,
            order: (body as FaqReorderPayload).order
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
