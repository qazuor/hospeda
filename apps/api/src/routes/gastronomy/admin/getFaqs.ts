/**
 * GET /api/v1/admin/gastronomies/:id/faqs
 * Get all FAQs for a gastronomy listing — Admin endpoint.
 */
import { GastronomyFaqListOutputSchema, PermissionEnum } from '@repo/schemas';
import { GastronomyService, ServiceError, listGastronomyFaqs } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * GET /api/v1/admin/gastronomies/:id/faqs
 * Get gastronomy FAQs — Admin endpoint.
 *
 * Requires COMMERCE_VIEW_ALL. Uses the standalone `listGastronomyFaqs` helper
 * that mirrors the protected/public FAQ list pattern.
 */
export const adminGetGastronomyFaqsRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/faqs',
    summary: 'Get gastronomy listing FAQs (admin)',
    description: 'Retrieve all FAQs for a gastronomy listing. Requires COMMERCE_VIEW_ALL.',
    tags: ['Gastronomy', 'FAQs'],
    requiredPermissions: [PermissionEnum.COMMERCE_VIEW_ALL],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: GastronomyFaqListOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            gastronomyService as unknown as { model: Parameters<typeof listGastronomyFaqs>[0] }
        ).model;

        const result = await listGastronomyFaqs(model, actor, {
            gastronomyId: params.id as string
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { faqs: result.data?.faqs || [] };
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
