/**
 * Public experience FAQs endpoint (T-019)
 * Returns FAQs for a specific experience listing ordered by display_order ASC NULLS LAST.
 *
 * Uses listExperienceFaqs() which loads the listing with its `faqs` relation
 * and returns active, non-deleted FAQs. Any authenticated or anonymous actor
 * that can view the listing can read its FAQs (open public).
 */
import { ExperienceFaqListOutputSchema } from '@repo/schemas';
import { ExperienceService, ServiceError, listExperienceFaqs } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

/** Experience service instance for FAQ helpers (injected from ExperienceService). */
const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * GET /api/v1/public/experiences/:experienceId/faqs
 * List FAQs for an experience listing — Public endpoint.
 *
 * Returns the FAQ array ordered by displayOrder ASC NULLS LAST.
 * Returns 404 when the listing does not exist.
 */
export const publicGetExperienceFaqsRoute = createPublicRoute({
    method: 'get',
    path: '/{experienceId}/faqs',
    summary: 'List FAQs for an experience listing',
    description:
        'Returns frequently asked questions for an experience listing, ordered by display order',
    tags: ['Experience', 'Experience FAQs'],
    requestParams: {
        experienceId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: ExperienceFaqListOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        // TYPE-WORKAROUND: access the internal experienceModel from the service instance
        // to pass to the standalone FAQ helper. The service exposes it via protected
        // `model` — we cast through unknown to satisfy TypeScript without `any`.
        const model = (
            experienceService as unknown as { model: Parameters<typeof listExperienceFaqs>[0] }
        ).model;

        const result = await listExperienceFaqs(model, actor, {
            experienceId: params.experienceId as string
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
