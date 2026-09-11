/**
 * Public gastronomy FAQs endpoint (T-042)
 * Returns FAQs for a specific gastronomy listing ordered by display_order ASC NULLS LAST.
 *
 * Uses listGastronomyFaqs() which loads the listing with its `faqs` relation
 * and returns active, non-deleted FAQs. Any authenticated or anonymous actor
 * that can view the listing can read its FAQs (open public).
 *
 * HOS-400: `listGastronomyFaqs` is shared with the admin/owner reads, which must
 * stay unfiltered — a hidden FAQ must remain visible in the screen meant to
 * manage it. So the `isVisibleOnListing` filter is applied HERE, server-side,
 * before the row ever leaves this route — filtering only on the client would
 * still ship the private FAQ in the page's payload.
 */
import { GastronomyFaqPublicListOutputSchema } from '@repo/schemas';
import { GastronomyService, listGastronomyFaqs, ServiceError } from '@repo/service-core';
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
    responseSchema: GastronomyFaqPublicListOutputSchema,
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

        const faqs = result.data?.faqs ?? [];
        // HOS-400 G-4/AC-8: `isVisibleOnListing = false` FAQs never leave this
        // route. A FAQ missing the field (pre-migration data) reads as visible,
        // matching the column's `DEFAULT true`.
        return { faqs: faqs.filter((faq) => faq.isVisibleOnListing !== false) };
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
