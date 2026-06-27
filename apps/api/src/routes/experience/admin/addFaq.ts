/**
 * POST /api/v1/admin/experiences/:id/faqs
 * Add a new FAQ to an experience listing — Admin endpoint.
 */
import {
    type ExperienceFaqAddInput,
    ExperienceFaqSingleOutputSchema,
    FaqCreatePayloadSchema,
    type FaqCreatePayloadType,
    PermissionEnum
} from '@repo/schemas';
import { ExperienceService, ServiceError, addExperienceFaq } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * POST /api/v1/admin/experiences/:id/faqs
 * Add FAQ to experience listing — Admin endpoint.
 *
 * Requires COMMERCE_EDIT_ALL permission. The service helper
 * `addExperienceFaq` enforces the same gate via `checkExperienceCanEditFaqs`.
 */
export const adminAddExperienceFaqRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/faqs',
    summary: 'Add FAQ to experience listing (admin)',
    description:
        'Adds a new frequently asked question to an experience listing. Requires COMMERCE_EDIT_ALL.',
    tags: ['Experience', 'FAQs'],
    requiredPermissions: [PermissionEnum.COMMERCE_EDIT_ALL],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: FaqCreatePayloadSchema,
    responseSchema: ExperienceFaqSingleOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const input: ExperienceFaqAddInput = {
            experienceId: params.id as string,
            faq: body as FaqCreatePayloadType
        };

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            experienceService as unknown as { model: Parameters<typeof addExperienceFaq>[0] }
        ).model;
        const result = await addExperienceFaq(model, actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
