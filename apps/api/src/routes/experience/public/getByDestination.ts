/**
 * Public get experience listings by destination endpoint (T-019)
 * Returns a paginated list of experience listings for a specific destination.
 *
 * Delegates to ExperienceService.search() with a forced destinationId filter.
 * ExperienceService does not expose a dedicated getByDestination() method
 * (that is AccommodationService-specific); the destinationId scalar filter in
 * _executeSearch provides equivalent behaviour.
 */
import { ExperiencePublicSchema } from '@repo/schemas';
import { ExperienceService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * GET /api/v1/public/experiences/destination/:destinationId
 * List experience listings by destination — Public endpoint.
 *
 * Uses ExperienceService.search() with a forced destinationId filter.
 * Pagination defaults: page=1, pageSize=20.
 */
export const publicGetExperiencesByDestinationRoute = createPublicListRoute({
    method: 'get',
    path: '/destination/{destinationId}',
    summary: 'Get experience listings by destination',
    description: 'Returns experience listings for a specific destination',
    tags: ['Experience'],
    requestParams: {
        destinationId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: ExperiencePublicSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await experienceService.search(actor, {
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
