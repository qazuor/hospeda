/**
 * Public amenity list endpoint
 * Returns paginated list of public amenities
 */
import {
    AmenityPublicSchema,
    AmenitySearchHttpSchema,
    type HttpAmenitySearch
} from '@repo/schemas';
import { AmenityService, PUBLIC_CATALOG_SORT_COLUMNS, ServiceError } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination.js';
import { createPublicListRoute } from '../../../utils/route-factory.js';

const amenityService = new AmenityService({ logger: apiLogger });

/**
 * GET /api/v1/public/amenities
 * List amenities - Public endpoint
 */
export const publicListAmenitiesRoute = createPublicListRoute({
    method: 'get',
    path: '/',
    summary: 'List amenities',
    description: 'Returns a paginated list of public amenities',
    tags: ['Amenities'],
    // HOS-2068: only allow-listed columns may drive the order; anything else is a 400.
    requestQuery: {
        ...AmenitySearchHttpSchema.shape,
        sortBy: z.enum(PUBLIC_CATALOG_SORT_COLUMNS).optional()
    },
    responseSchema: AmenityPublicSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await amenityService.search(actor, {
            ...(query as HttpAmenitySearch),
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
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
