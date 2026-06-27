/**
 * PUT /api/v1/protected/gastronomies/:id/faqs/:faqId
 * Update an existing FAQ on a gastronomy listing (T-044)
 *
 * Gated on COMMERCE_EDIT_OWN (listing owner) or COMMERCE_EDIT_ALL (staff).
 * The FAQ must belong to the specified gastronomy (enforced inside updateGastronomyFaq).
 */
import {
    FaqUpdatePayloadSchema,
    type FaqUpdatePayloadType,
    GastronomyFaqSingleOutputSchema,
    type GastronomyFaqUpdateInput
} from '@repo/schemas';
import { GastronomyService, ServiceError, updateGastronomyFaq } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * Route handler — updates a specific FAQ on a gastronomy listing.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service instance
 * to pass to the standalone FAQ helper without requiring a public accessor.
 */
export const protectedUpdateGastronomyFaqRoute = createCRUDRoute({
    method: 'put',
    path: '/{id}/faqs/{faqId}',
    summary: 'Update FAQ on gastronomy listing',
    description: 'Updates an existing FAQ on a gastronomy listing',
    tags: ['Gastronomy', 'Gastronomy FAQs'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
        faqId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: FaqUpdatePayloadSchema,
    responseSchema: GastronomyFaqSingleOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const input: GastronomyFaqUpdateInput = {
            gastronomyId: params.id as string,
            faqId: params.faqId as string,
            faq: body as FaqUpdatePayloadType
        };

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            gastronomyService as unknown as { model: Parameters<typeof updateGastronomyFaq>[0] }
        ).model;
        const result = await updateGastronomyFaq(model, actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
