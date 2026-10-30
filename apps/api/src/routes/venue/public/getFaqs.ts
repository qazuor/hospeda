/**
 * Public venue FAQs endpoint (T-042)
 * Returns FAQs for a specific venue listing ordered by display_order ASC NULLS LAST.
 *
 * Uses listVenueFaqs() which loads the listing with its `faqs` relation
 * and returns active, non-deleted FAQs. Any authenticated or anonymous actor
 * that can view the listing can read its FAQs (open public).
 *
 * HOS-400: `listVenueFaqs` is shared with the admin/owner reads, which must
 * stay unfiltered — a hidden FAQ must remain visible in the screen meant to
 * manage it. So the `isVisibleOnListing` filter is applied HERE, server-side,
 * before the row ever leaves this route — filtering only on the client would
 * still ship the private FAQ in the page's payload.
 */
import { VenueFaqPublicListOutputSchema } from '@repo/schemas';
import { listVenueFaqs, ServiceError, VenueService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { filterPublicFaqs } from '../../../utils/listing-faq-visibility';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

/** Venue model instance for FAQ helpers (injected from VenueService). */
const venueService = new VenueService({ logger: apiLogger });

/**
 * GET /api/v1/public/venues/:venueId/faqs
 * List FAQs for a venue listing — Public endpoint.
 *
 * Returns the FAQ array ordered by displayOrder ASC NULLS LAST.
 * Returns 404 when the listing does not exist.
 */
export const publicGetVenueFaqsRoute = createPublicRoute({
    method: 'get',
    path: '/{venueId}/faqs',
    summary: 'List FAQs for a venue listing',
    description: 'Returns frequently asked questions for a venue listing, ordered by display order',
    tags: ['Venue', 'Venue FAQs'],
    requestParams: {
        venueId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: VenueFaqPublicListOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        // TYPE-WORKAROUND: access the internal venueModel from the service instance
        // to pass to the standalone FAQ helper. The service exposes it via protected
        // `model` — we cast through unknown to satisfy TypeScript without `any`.
        const model = (venueService as unknown as { model: Parameters<typeof listVenueFaqs>[0] })
            .model;

        const result = await listVenueFaqs(model, actor, {
            venueId: params.venueId as string
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const faqs = result.data?.faqs ?? [];
        // HOS-400 G-4/AC-8: FAQs that are not ACTIVE, are soft-deleted or have
        // `isVisibleOnListing = false` never leave this route (HOS-1263). A FAQ missing the field (pre-migration data) reads as visible,
        // matching the column's `DEFAULT true`.
        return { faqs: filterPublicFaqs(faqs) };
    },
    options: {
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
