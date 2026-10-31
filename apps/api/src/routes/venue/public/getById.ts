/**
 * Public get venue listing by ID endpoint (T-042)
 * Returns a single venue listing projected through VenuePublicSchema.
 * Returns 404 when the listing is not visible (non-existent, soft-deleted, or non-public).
 */
import { VenuePublicSchema } from '@repo/schemas';
import { ServiceError, VenueService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { withPublicIsFeatured } from '../../../utils/accommodation-featured';
import { getActorFromContext } from '../../../utils/actor';
import { withPublicVisibleFaqs } from '../../../utils/listing-faq-visibility';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';
import { gateVenueMenuFile } from './menu-file-gate';

const venueService = new VenueService({ logger: apiLogger });

/**
 * GET /api/v1/public/venues/:id
 * Get venue listing by ID — Public endpoint.
 *
 * Returns null (404) when the listing does not exist or is not publicly visible.
 * The service's _canView check and projection apply.
 */
export const publicGetVenueByIdRoute = createPublicRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get venue listing by ID',
    description: 'Retrieves a venue listing by its UUID',
    tags: ['Venue'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: VenuePublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await venueService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        // HOS-1286: the public `isFeatured`, derived in the PUBLIC tier only.
        if (!result.data) {
            return null;
        }
        // HOS-1792: same menu-file projection as by-slug.
        const venue = await gateVenueMenuFile({ venue: withPublicVisibleFaqs(result.data) });
        return withPublicIsFeatured(venue);
    },
    options: {
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
