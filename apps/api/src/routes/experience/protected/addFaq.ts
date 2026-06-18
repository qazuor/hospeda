/**
 * POST /api/v1/protected/experiences/:id/faqs
 * Add a new FAQ to an experience listing (T-020)
 *
 * Gated on COMMERCE_FAQS_EDIT_OWN (listing owner) or COMMERCE_EDIT_ALL (staff).
 * displayOrder is auto-assigned by addExperienceFaq() as max(existing)+1.
 */
import {
    type ExperienceFaqAddInput,
    ExperienceFaqSingleOutputSchema,
    FaqCreatePayloadSchema,
    type FaqCreatePayloadType
} from '@repo/schemas';
import { ExperienceService, ServiceError, addExperienceFaq } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * Route handler — adds a FAQ to the specified experience listing.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service instance
 * to pass to the standalone FAQ helper without requiring a public accessor.
 */
export const protectedAddExperienceFaqRoute = createCRUDRoute({
    method: 'post',
    path: '/{id}/faqs',
    summary: 'Add FAQ to experience listing',
    description: 'Adds a new frequently asked question to an experience listing',
    tags: ['Experience', 'Experience FAQs'],
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
