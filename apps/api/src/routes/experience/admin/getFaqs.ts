/**
 * GET /api/v1/admin/experiences/:id/faqs
 * Get all FAQs for an experience listing — Admin endpoint.
 */
import { ExperienceFaqListOutputSchema, PermissionEnum } from '@repo/schemas';
import { ExperienceService, ServiceError, listExperienceFaqs } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * GET /api/v1/admin/experiences/:id/faqs
 * Get experience FAQs — Admin endpoint.
 *
 * Requires COMMERCE_VIEW_ALL. Uses the standalone `listExperienceFaqs` helper
 * that mirrors the protected/public FAQ list pattern.
 */
export const adminGetExperienceFaqsRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/faqs',
    summary: 'Get experience listing FAQs (admin)',
    description: 'Retrieve all FAQs for an experience listing. Requires COMMERCE_VIEW_ALL.',
    tags: ['Experience', 'FAQs'],
    requiredPermissions: [PermissionEnum.COMMERCE_VIEW_ALL],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: ExperienceFaqListOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            experienceService as unknown as { model: Parameters<typeof listExperienceFaqs>[0] }
        ).model;

        const result = await listExperienceFaqs(model, actor, {
            experienceId: params.id as string
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
