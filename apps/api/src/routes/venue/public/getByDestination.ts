/**
 * Public get venue listings by destination endpoint (T-042)
 * Returns a paginated list of venue listings for a specific destination.
 *
 * Delegates to VenueService.search() with a forced destinationId filter.
 * VenueService does not expose a dedicated getByDestination() method
 * (that is AccommodationService-specific); the destinationId scalar filter in
 * _executeSearch provides equivalent behaviour.
 */
import { VenuePublicSchema } from '@repo/schemas';
import { ServiceError, VenueService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { withPublicIsFeaturedList } from '../../../utils/accommodation-featured';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });

/**
 * GET /api/v1/public/venues/destination/:destinationId
 * List venue listings by destination — Public endpoint.
 *
 * Uses VenueService.search() with a forced destinationId filter.
 * Pagination defaults: page=1, pageSize=20.
 */
export const publicGetVenuesByDestinationRoute = createPublicListRoute({
    method: 'get',
    path: '/destination/{destinationId}',
    summary: 'Get gastronomy listings by destination',
    description: 'Returns gastronomy listings for a specific destination',
    tags: ['Venue'],
    requestParams: {
        destinationId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: VenuePublicSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await venueService.search(actor, {
            destinationId: params.destinationId as string,
            page,
            pageSize
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: withPublicIsFeaturedList(result.data?.items || []),
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    },
    options: {
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
