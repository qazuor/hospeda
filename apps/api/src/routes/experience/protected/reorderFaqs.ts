/**
 * PUT /api/v1/protected/experiences/:id/faqs/reorder
 * Reorder FAQs on an experience listing (T-020 / SPEC-177 pattern)
 *
 * The caller supplies an explicit { faqId, displayOrder }[] array.
 * The service validates that all faqId values belong to the specified experience.
 * Gated on COMMERCE_FAQS_EDIT_OWN (listing owner) or COMMERCE_EDIT_ALL (staff).
 */
import { ExperienceFaqRemoveOutputSchema, FaqReorderPayloadSchema } from '@repo/schemas';
import { ExperienceService, ServiceError, reorderExperienceFaqs } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * Route handler — reorders FAQs on an experience listing.
 *
 * NOTE: this route must be registered BEFORE /{id}/faqs/{faqId} so that Hono
 * does not treat "reorder" as a faqId param value. The index.ts registers it
 * first.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service instance
 * to pass to the standalone FAQ helper without requiring a public accessor.
 */
export const protectedReorderExperienceFaqsRoute = createCRUDRoute({
    method: 'put',
    path: '/{id}/faqs/reorder',
    summary: 'Reorder FAQs on experience listing',
    description: 'Sets a new display order for FAQs belonging to the given experience listing',
    tags: ['Experience', 'Experience FAQs'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: FaqReorderPayloadSchema,
    responseSchema: ExperienceFaqRemoveOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            experienceService as unknown as { model: Parameters<typeof reorderExperienceFaqs>[0] }
        ).model;
        const result = await reorderExperienceFaqs(model, actor, {
            experienceId: params.id as string,
            order: (body as { order: Array<{ faqId: string; displayOrder: number }> }).order
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data ?? { success: true };
    }
});
