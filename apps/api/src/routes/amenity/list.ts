import { AmenityListItemSchema, AmenitySearchHttpSchema } from '@repo/schemas';
import { AmenityService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

// Instantiate service inside handler for test mocks

export const amenityListRoute = createListRoute({
    method: 'get',
    path: '/amenities',
    summary: 'List amenities',
    description: 'Returns a paginated list of amenities using standardized HTTP schemas',
    tags: ['Amenities'],
    requestQuery: AmenitySearchHttpSchema.shape,
    responseSchema: AmenityListItemSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query as Record<string, unknown>);
        const service = new AmenityService({ logger: apiLogger });
        const result = await service.list(actor, {
            page,
            pageSize
        });

        if (result.error) {
            throw new Error(result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
