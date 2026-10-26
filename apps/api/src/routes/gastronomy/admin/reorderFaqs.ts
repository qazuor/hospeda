/**
 * PATCH /api/v1/admin/gastronomies/:id/faqs/reorder
 * Reorder FAQs for a gastronomy listing — Admin endpoint.
 *
 * MUST be registered BEFORE /{id}/faqs/{faqId} to prevent "reorder" from
 * being captured as a faqId param.
 */
import {
    type FaqReorderPayload,
    FaqReorderPayloadSchema,
    SuccessSchema,
    VenueFaqReorderInputSchema,
    VerticalEnum
} from '@repo/schemas';
import { reorderVenueFaqs, ServiceError, VenueService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { runListingContentCall } from '../../../middlewares/listing-access';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const gastronomyService = new VenueService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/gastronomies/:id/faqs/reorder
 * Reorder FAQs for a gastronomy listing — Admin endpoint.
 *
 * Validates that all supplied faqId values belong to the given listing before
 * applying displayOrder updates. Requires GASTRONOMY_EDIT_ALL permission.
 */
export const adminReorderGastronomyFaqsRoute = createAdminRoute({
    method: 'patch',
    listingAccess: { vertical: VerticalEnum.VENUE, operation: 'EDIT', idParam: 'id' },
    path: '/{id}/faqs/reorder',
    summary: 'Reorder FAQs for a gastronomy listing (admin)',
    description:
        'Sets displayOrder for a set of FAQs belonging to a gastronomy listing. All faqId values must belong to the given listing. Requires GASTRONOMY_EDIT_ALL.',
    tags: ['Gastronomy', 'FAQs'],
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

        const reorderInput = VenueFaqReorderInputSchema.parse({
            gastronomyId: params.id as string,
            order: (body as FaqReorderPayload).order
        });

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            gastronomyService as unknown as { model: Parameters<typeof reorderVenueFaqs>[0] }
        ).model;
        const result = await runListingContentCall({
            ctx,
            run: () => reorderVenueFaqs(model, actor, reorderInput)
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
