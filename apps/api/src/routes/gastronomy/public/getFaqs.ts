/**
 * Public gastronomy FAQs endpoint (T-042)
 * Returns FAQs for a specific gastronomy listing ordered by display_order ASC NULLS LAST.
 *
 * Uses listGastronomyFaqs() which loads the listing with its `faqs` relation
 * and returns active, non-deleted FAQs. Any authenticated or anonymous actor
 * that can view the listing can read its FAQs (open public).
 */
import { GastronomyFaqListOutputSchema } from '@repo/schemas';
import { GastronomyService, ServiceError, listGastronomyFaqs } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

/** Gastronomy model instance for FAQ helpers (injected from GastronomyService). */
const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * GET /api/v1/public/gastronomies/:gastronomyId/faqs
 * List FAQs for a gastronomy listing — Public endpoint.
 *
 * Returns the FAQ array ordered by displayOrder ASC NULLS LAST.
 * Returns 404 when the listing does not exist.
 */
export const publicGetGastronomyFaqsRoute = createPublicRoute({
    method: 'get',
    path: '/{gastronomyId}/faqs',
    summary: 'List FAQs for a gastronomy listing',
    description:
        'Returns frequently asked questions for a gastronomy listing, ordered by display order',
    tags: ['Gastronomy', 'Gastronomy FAQs'],
    requestParams: {
        gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: GastronomyFaqListOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        // TYPE-WORKAROUND: access the internal gastronomyModel from the service instance
        // to pass to the standalone FAQ helper. The service exposes it via protected
        // `model` — we cast through unknown to satisfy TypeScript without `any`.
        const model = (
            gastronomyService as unknown as { model: Parameters<typeof listGastronomyFaqs>[0] }
        ).model;

        const result = await listGastronomyFaqs(model, actor, {
            gastronomyId: params.gastronomyId as string
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data ?? { faqs: [] };
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
