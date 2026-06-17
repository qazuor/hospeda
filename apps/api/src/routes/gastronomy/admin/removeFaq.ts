/**
 * DELETE /api/v1/admin/gastronomies/:id/faqs/:faqId
 * Remove an existing FAQ from a gastronomy listing — Admin endpoint.
 */
import {
    type GastronomyFaqRemoveInput,
    GastronomyFaqRemoveOutputSchema,
    PermissionEnum
} from '@repo/schemas';
import { GastronomyService, ServiceError, removeGastronomyFaq } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/gastronomies/:id/faqs/:faqId
 * Remove FAQ from gastronomy listing — Admin endpoint.
 *
 * Requires COMMERCE_EDIT_ALL permission. The service helper
 * `removeGastronomyFaq` enforces the same gate via `checkGastronomyCanEditFaqs`.
 */
export const adminRemoveGastronomyFaqRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/faqs/{faqId}',
    summary: 'Remove FAQ from gastronomy listing (admin)',
    description: 'Removes a FAQ from a gastronomy listing. Requires COMMERCE_EDIT_ALL.',
    tags: ['Gastronomy', 'FAQs'],
    requiredPermissions: [PermissionEnum.COMMERCE_EDIT_ALL],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
        faqId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: GastronomyFaqRemoveOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        const input: GastronomyFaqRemoveInput = {
            gastronomyId: params.id as string,
            faqId: params.faqId as string
        };

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            gastronomyService as unknown as { model: Parameters<typeof removeGastronomyFaq>[0] }
        ).model;
        const result = await removeGastronomyFaq(model, actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
