/**
 * DELETE /api/v1/public/accommodations/:id/faqs/:faqId
 * Remove an existing FAQ from an accommodation
 */

import { EntitlementKey } from '@repo/billing';
import {
    AccommodationFaqIdSchema,
    AccommodationIdSchema,
    DeleteResultSchema,
    ProductDomainEnum
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { requireEntitlement } from '../../../middlewares/entitlement';
import { requireLiveSubscription } from '../../../middlewares/require-live-subscription';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

// Initialize service once
const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Route definition using createCRUDRoute factory
 */
export const removeFaqRoute = createCRUDRoute({
    method: 'delete',
    path: '/{id}/faqs/{faqId}',
    summary: 'Remove FAQ from accommodation',
    description: 'Remove an FAQ from a specific accommodation',
    tags: ['Accommodations', 'FAQs'],
    requestParams: {
        id: AccommodationIdSchema,
        faqId: AccommodationFaqIdSchema
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const { id, faqId } = params;
        const actor = getActorFromContext(ctx);

        const result = await accommodationService.removeFaq(actor, {
            accommodationId: id as string,
            faqId: faqId as string
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            success: true,
            data: result.data
        };
    },
    options: {
        // HOS-1275: DELETING content is mutating it. These two routes carried no
        // entitlement gate at all — not in commerce, and not in accommodation
        // either, which PR #3299's own write-up missed because it only surveyed
        // commerce. Wired here with the same pair every sibling content route
        // carries, so the six of them stop being the exception that the next
        // change to the EDIT_* keys would silently leave behind.
        middlewares: [
            requireEntitlement(EntitlementKey.EDIT_ACCOMMODATION_INFO),
            requireLiveSubscription(ProductDomainEnum.ACCOMMODATION)
        ]
    }
});
