/**
 * PATCH /api/v1/admin/experiences/:id/faqs/reorder
 * Reorder FAQs for an experience listing — Admin endpoint.
 *
 * MUST be registered BEFORE /{id}/faqs/{faqId} to prevent "reorder" from
 * being captured as a faqId param.
 */
import {
    ExperienceFaqReorderInputSchema,
    type FaqReorderPayload,
    FaqReorderPayloadSchema,
    PermissionEnum,
    SuccessSchema
} from '@repo/schemas';
import { ExperienceService, ServiceError, reorderExperienceFaqs } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/experiences/:id/faqs/reorder
 * Reorder FAQs for an experience listing — Admin endpoint.
 *
 * Validates that all supplied faqId values belong to the given listing before
 * applying displayOrder updates. Requires COMMERCE_EDIT_ALL permission.
 */
export const adminReorderExperienceFaqsRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}/faqs/reorder',
    summary: 'Reorder FAQs for an experience listing (admin)',
    description:
        'Sets displayOrder for a set of FAQs belonging to an experience listing. All faqId values must belong to the given listing. Requires COMMERCE_EDIT_ALL.',
    tags: ['Experience', 'FAQs'],
    requiredPermissions: [PermissionEnum.COMMERCE_EDIT_ALL],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: FaqReorderPayloadSchema,
    responseSchema: SuccessSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const reorderInput = ExperienceFaqReorderInputSchema.parse({
            experienceId: params.id as string,
            order: (body as FaqReorderPayload).order
        });

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            experienceService as unknown as { model: Parameters<typeof reorderExperienceFaqs>[0] }
        ).model;
        const result = await reorderExperienceFaqs(model, actor, reorderInput);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
