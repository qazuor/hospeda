/**
 * POST /api/v1/protected/gastronomies/:id/faqs
 * Add a new FAQ to a gastronomy listing (T-044)
 *
 * Gated on COMMERCE_EDIT_OWN (listing owner) or COMMERCE_EDIT_ALL (staff).
 * displayOrder is auto-assigned by addGastronomyFaq() as max(existing)+1.
 */
import {
    FaqCreatePayloadSchema,
    type FaqCreatePayloadType,
    type GastronomyFaqAddInput,
    GastronomyFaqSingleOutputSchema
} from '@repo/schemas';
import { GastronomyService, ServiceError, addGastronomyFaq } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * Route handler — adds a FAQ to the specified gastronomy listing.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service instance
 * to pass to the standalone FAQ helper without requiring a public accessor.
 */
export const protectedAddGastronomyFaqRoute = createCRUDRoute({
    method: 'post',
    path: '/{id}/faqs',
    summary: 'Add FAQ to gastronomy listing',
    description: 'Adds a new frequently asked question to a gastronomy listing',
    tags: ['Gastronomy', 'Gastronomy FAQs'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: FaqCreatePayloadSchema,
    responseSchema: GastronomyFaqSingleOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const input: GastronomyFaqAddInput = {
            gastronomyId: params.id as string,
            faq: body as FaqCreatePayloadType
        };

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            gastronomyService as unknown as { model: Parameters<typeof addGastronomyFaq>[0] }
        ).model;
        const result = await addGastronomyFaq(model, actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
