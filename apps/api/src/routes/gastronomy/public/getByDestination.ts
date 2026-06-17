/**
 * Public get gastronomy listings by destination endpoint (T-042)
 * Returns a paginated list of gastronomy listings for a specific destination.
 *
 * Delegates to GastronomyService.search() with a forced destinationId filter.
 * GastronomyService does not expose a dedicated getByDestination() method
 * (that is AccommodationService-specific); the destinationId scalar filter in
 * _executeSearch provides equivalent behaviour.
 */
import { GastronomyPublicSchema } from '@repo/schemas';
import { GastronomyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * GET /api/v1/public/gastronomies/destination/:destinationId
 * List gastronomy listings by destination — Public endpoint.
 *
 * Uses GastronomyService.search() with a forced destinationId filter.
 * Pagination defaults: page=1, pageSize=20.
 */
export const publicGetGastronomiesByDestinationRoute = createPublicListRoute({
    method: 'get',
    path: '/destination/{destinationId}',
    summary: 'Get gastronomy listings by destination',
    description: 'Returns gastronomy listings for a specific destination',
    tags: ['Gastronomy'],
    requestParams: {
        destinationId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: GastronomyPublicSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await gastronomyService.search(actor, {
            destinationId: params.destinationId as string,
            page,
            pageSize
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
