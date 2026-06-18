/**
 * DELETE /api/v1/admin/experiences/:id/faqs/:faqId
 * Remove an existing FAQ from an experience listing — Admin endpoint.
 */
import {
    type ExperienceFaqRemoveInput,
    ExperienceFaqRemoveOutputSchema,
    PermissionEnum
} from '@repo/schemas';
import { ExperienceService, ServiceError, removeExperienceFaq } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/experiences/:id/faqs/:faqId
 * Remove FAQ from experience listing — Admin endpoint.
 *
 * Requires COMMERCE_EDIT_ALL permission. The service helper
 * `removeExperienceFaq` enforces the same gate via `checkExperienceCanEditFaqs`.
 */
export const adminRemoveExperienceFaqRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/faqs/{faqId}',
    summary: 'Remove FAQ from experience listing (admin)',
    description: 'Removes a FAQ from an experience listing. Requires COMMERCE_EDIT_ALL.',
    tags: ['Experience', 'FAQs'],
    requiredPermissions: [PermissionEnum.COMMERCE_EDIT_ALL],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
        faqId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: ExperienceFaqRemoveOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        const input: ExperienceFaqRemoveInput = {
            experienceId: params.id as string,
            faqId: params.faqId as string
        };

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            experienceService as unknown as { model: Parameters<typeof removeExperienceFaq>[0] }
        ).model;
        const result = await removeExperienceFaq(model, actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
