/**
 * PUT /api/v1/admin/experiences/:id/faqs/:faqId
 * Update an existing FAQ in an experience listing — Admin endpoint.
 */
import {
    ExperienceFaqSingleOutputSchema,
    type ExperienceFaqUpdateInput,
    FaqUpdatePayloadSchema,
    type FaqUpdatePayloadType,
    PermissionEnum
} from '@repo/schemas';
import { ExperienceService, ServiceError, updateExperienceFaq } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/experiences/:id/faqs/:faqId
 * Update FAQ in experience listing — Admin endpoint.
 *
 * Requires COMMERCE_EDIT_ALL permission. The service helper
 * `updateExperienceFaq` enforces the same gate via `checkExperienceCanEditFaqs`.
 */
export const adminUpdateExperienceFaqRoute = createAdminRoute({
    method: 'put',
    path: '/{id}/faqs/{faqId}',
    summary: 'Update FAQ in experience listing (admin)',
    description: 'Updates an existing FAQ in an experience listing. Requires COMMERCE_EDIT_ALL.',
    tags: ['Experience', 'FAQs'],
    requiredPermissions: [PermissionEnum.COMMERCE_EDIT_ALL],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
        faqId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: FaqUpdatePayloadSchema,
    responseSchema: ExperienceFaqSingleOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const input: ExperienceFaqUpdateInput = {
            experienceId: params.id as string,
            faqId: params.faqId as string,
            faq: body as FaqUpdatePayloadType
        };

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            experienceService as unknown as { model: Parameters<typeof updateExperienceFaq>[0] }
        ).model;
        const result = await updateExperienceFaq(model, actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
