/**
 * POST /api/v1/admin/gastronomies/:id/faqs
 * Add a new FAQ to a gastronomy listing — Admin endpoint.
 */
import {
    FaqCreatePayloadSchema,
    type FaqCreatePayloadType,
    type GastronomyFaqAddInput,
    GastronomyFaqSingleOutputSchema,
    PermissionEnum
} from '@repo/schemas';
import { GastronomyService, ServiceError, addGastronomyFaq } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * POST /api/v1/admin/gastronomies/:id/faqs
 * Add FAQ to gastronomy listing — Admin endpoint.
 *
 * Requires COMMERCE_EDIT_ALL permission. The service helper
 * `addGastronomyFaq` enforces the same gate via `checkGastronomyCanEditFaqs`.
 */
export const adminAddGastronomyFaqRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/faqs',
    summary: 'Add FAQ to gastronomy listing (admin)',
    description:
        'Adds a new frequently asked question to a gastronomy listing. Requires COMMERCE_EDIT_ALL.',
    tags: ['Gastronomy', 'FAQs'],
    requiredPermissions: [PermissionEnum.COMMERCE_EDIT_ALL],
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
