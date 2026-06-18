/**
 * PUT /api/v1/protected/experiences/:id/faqs/:faqId
 * Update an existing FAQ on an experience listing (T-020)
 *
 * Gated on COMMERCE_FAQS_EDIT_OWN (listing owner) or COMMERCE_EDIT_ALL (staff).
 * The FAQ must belong to the specified experience (enforced inside updateExperienceFaq).
 */
import {
    ExperienceFaqSingleOutputSchema,
    type ExperienceFaqUpdateInput,
    FaqUpdatePayloadSchema,
    type FaqUpdatePayloadType
} from '@repo/schemas';
import { ExperienceService, ServiceError, updateExperienceFaq } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * Route handler — updates a specific FAQ on an experience listing.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service instance
 * to pass to the standalone FAQ helper without requiring a public accessor.
 */
export const protectedUpdateExperienceFaqRoute = createCRUDRoute({
    method: 'put',
    path: '/{id}/faqs/{faqId}',
    summary: 'Update FAQ on experience listing',
    description: 'Updates an existing FAQ on an experience listing',
    tags: ['Experience', 'Experience FAQs'],
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
