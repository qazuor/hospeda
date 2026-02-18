import {
    DestinationListItemSchema,
    DestinationSearchHttpSchema,
    type ServiceErrorCode
} from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

export const destinationListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List destinations',
    description: 'Returns a paginated list of destinations using the DestinationService',
    tags: ['Destinations'],
    requestQuery: DestinationSearchHttpSchema.shape,
    responseSchema: DestinationListItemSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query as Record<string, unknown>);
        const safeQuery = (query as Record<string, unknown>) || {};

        const searchParams: Record<string, unknown> = { page, pageSize };
        if (safeQuery.q) searchParams.q = safeQuery.q;
        if (safeQuery.isFeatured !== undefined) searchParams.isFeatured = safeQuery.isFeatured;
        if (safeQuery.country) searchParams.country = safeQuery.country;
        if (safeQuery.state) searchParams.state = safeQuery.state;
        if (safeQuery.city) searchParams.city = safeQuery.city;
        if (safeQuery.parentDestinationId)
            searchParams.parentDestinationId = safeQuery.parentDestinationId;
        if (safeQuery.destinationType) searchParams.destinationType = safeQuery.destinationType;
        if (safeQuery.level !== undefined) searchParams.level = safeQuery.level;
        if (safeQuery.ancestorId) searchParams.ancestorId = safeQuery.ancestorId;

        const result = await destinationService.search(
            actor,
            searchParams as Parameters<typeof destinationService.search>[1]
        );

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    },
    options: {
        skipAuth: true,
        skipValidation: true,
        cacheTTL: 60,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
