/**
 * DELETE /api/v1/protected/gastronomies/:id/faqs/:faqId
 * Remove (soft-delete) a FAQ from a gastronomy listing (T-044)
 *
 * Gated on COMMERCE_EDIT_OWN (listing owner) or COMMERCE_EDIT_ALL (staff).
 * The FAQ must belong to the specified gastronomy (enforced inside removeGastronomyFaq).
 */
import { GastronomyFaqRemoveOutputSchema } from '@repo/schemas';
import { GastronomyService, ServiceError, removeGastronomyFaq } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * Route handler — soft-deletes a specific FAQ from a gastronomy listing.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service instance
 * to pass to the standalone FAQ helper without requiring a public accessor.
 */
export const protectedRemoveGastronomyFaqRoute = createCRUDRoute({
    method: 'delete',
    path: '/{id}/faqs/{faqId}',
    summary: 'Remove FAQ from gastronomy listing',
    description: 'Soft-deletes a FAQ from a gastronomy listing',
    tags: ['Gastronomy', 'Gastronomy FAQs'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
        faqId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: GastronomyFaqRemoveOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            gastronomyService as unknown as { model: Parameters<typeof removeGastronomyFaq>[0] }
        ).model;
        const result = await removeGastronomyFaq(model, actor, {
            gastronomyId: params.id as string,
            faqId: params.faqId as string
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data ?? { success: true };
    }
});
