/**
 * GET /api/v1/admin/venues/:id/faqs
 * Get all FAQs for a venue listing — Admin endpoint.
 */
import { PermissionEnum, VenueFaqListOutputSchema } from '@repo/schemas';
import { listVenueFaqs, ServiceError, VenueService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });

/**
 * GET /api/v1/admin/venues/:id/faqs
 * Get venue FAQs — Admin endpoint.
 *
 * Requires VENUE_VIEW_ALL. Uses the standalone `listVenueFaqs` helper
 * that mirrors the protected/public FAQ list pattern.
 */
export const adminGetVenueFaqsRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/faqs',
    summary: 'Get venue listing FAQs (admin)',
    description: 'Retrieve all FAQs for a venue listing. Requires VENUE_VIEW_ALL.',
    tags: ['Venue', 'FAQs'],
    anyOfPermissions: [[PermissionEnum.VENUE_VIEW_ALL]],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: VenueFaqListOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (venueService as unknown as { model: Parameters<typeof listVenueFaqs>[0] })
            .model;

        const result = await listVenueFaqs(model, actor, {
            venueId: params.id as string
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { faqs: result.data?.faqs || [] };
    },
    options: {
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
