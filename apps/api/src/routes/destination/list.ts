import { DestinationListItemSchema, HttpDestinationSearchSchema } from '@repo/schemas';
import { DestinationService } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

export const destinationListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List destinations',
    description: 'Returns a paginated list of destinations using the DestinationService',
    tags: ['Destinations'],
    requestQuery: HttpDestinationSearchSchema.shape, // ✅ Using @repo/schemas
    responseSchema: DestinationListItemSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const queryData = query as {
            page?: number;
            pageSize?: number;
            search?: string;
            q?: string;
        };
        const page = queryData.page ?? 1;
        const pageSize = queryData.pageSize ?? 20;

        const result = await destinationService.list(actor, {
            page,
            pageSize
        });

        if (result.error) {
            throw new Error(result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: {
                page,
                pageSize,
                total: result.data?.total || 0,
                totalPages: Math.ceil((result.data?.total || 0) / pageSize)
            }
        };
    },
    options: {
        skipAuth: true,
        skipValidation: true,
        cacheTTL: 60,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
