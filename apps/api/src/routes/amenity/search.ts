import {
    AmenitySchema,
    type HttpAmenitySearch,
    HttpAmenitySearchSchema,
    createPaginatedResponseSchema
} from '@repo/schemas';
import { AmenityService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

export const searchAmenitiesRoute = createListRoute({
    method: 'get',
    path: '/amenities/search',
    summary: 'Search amenities',
    description: 'Search amenities by filters and pagination',
    tags: ['Amenities'],
    requestQuery: HttpAmenitySearchSchema.shape,
    responseSchema: createPaginatedResponseSchema(AmenitySchema),
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const searchParams = query as HttpAmenitySearch;
        const { page, pageSize } = extractPaginationParams(searchParams);

        const service = new AmenityService({ logger: apiLogger });
        const result = await service.search(actor, searchParams);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
