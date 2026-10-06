/**
 * PUT /api/v1/protected/accommodations/:id/faqs/reorder
 * HOS-1352: transitional until V3 (HOS-1357), see PR — the former plan gate or limit is removed.
 */

import {
    AccommodationIdSchema,
    type FaqReorderPayload,
    FaqReorderPayloadSchema,
    SuccessSchema
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';

import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

// Initialize service once
const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Route definition using createCRUDRoute factory
 *
 * Permission model (SPEC-177): service layer `accommodationService.reorderFaqs`
 * calls `_canUpdate(actor, accommodation)` which enforces
 * `ACCOMMODATION_UPDATE_ANY` OR (`ACCOMMODATION_UPDATE_OWN` + ownership).
 * HOS-1352: transitional until V3 (HOS-1357), see PR — the former FAQ plan gate is removed.
 */
export const protectedReorderFaqsRoute = createCRUDRoute({
    method: 'put',
    path: '/{id}/faqs/reorder',
    summary: 'Reorder FAQs on accommodation (owner)',
    description:
        'Set the displayOrder for a set of FAQs belonging to an accommodation. All faqId ' +
        'values must belong to the given accommodation. Requires EDIT_ACCOMMODATION_INFO ' +
        'entitlement; the service layer enforces UPDATE_OWN + ownership.',
    tags: ['Accommodations', 'FAQs'],
    requestParams: {
        id: AccommodationIdSchema
    },
    requestBody: FaqReorderPayloadSchema,
    responseSchema: SuccessSchema,
    // HOS-1352: transitional until V3 (HOS-1357), see PR — removed EDIT_ACCOMMODATION_INFO entitlement gate.
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
    },
    options: {
        // HOS-1352: transitional until V3 (HOS-1357), see PR — former plan gate removed; route permissions remain.
    }
});
