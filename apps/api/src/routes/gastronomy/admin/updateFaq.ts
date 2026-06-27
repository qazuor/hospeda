/**
 * PUT /api/v1/admin/gastronomies/:id/faqs/:faqId
 * Update an existing FAQ in a gastronomy listing — Admin endpoint.
 */
import {
    FaqUpdatePayloadSchema,
    type FaqUpdatePayloadType,
    GastronomyFaqSingleOutputSchema,
    type GastronomyFaqUpdateInput,
    PermissionEnum
} from '@repo/schemas';
import { GastronomyService, ServiceError, updateGastronomyFaq } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/gastronomies/:id/faqs/:faqId
 * Update FAQ in gastronomy listing — Admin endpoint.
 *
 * Requires COMMERCE_EDIT_ALL permission. The service helper
 * `updateGastronomyFaq` enforces the same gate via `checkGastronomyCanEditFaqs`.
 */
export const adminUpdateGastronomyFaqRoute = createAdminRoute({
    method: 'put',
    path: '/{id}/faqs/{faqId}',
    summary: 'Update FAQ in gastronomy listing (admin)',
    description: 'Updates an existing FAQ in a gastronomy listing. Requires COMMERCE_EDIT_ALL.',
    tags: ['Gastronomy', 'FAQs'],
    requiredPermissions: [PermissionEnum.COMMERCE_EDIT_ALL],
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
