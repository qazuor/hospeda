import { ClientSchema, HttpClientSearchSchema, httpToDomainClientSearch } from '@repo/schemas';
import { ClientService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

export const clientListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List clients',
    description: 'Returns a paginated list of clients with filtering options',
    tags: ['Clients'],
    requestQuery: HttpClientSearchSchema.shape,
    responseSchema: ClientSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query as Record<string, unknown>);

        // Convert HTTP query params to domain search input
        const searchInput = httpToDomainClientSearch({
            ...(query as Record<string, unknown>),
            page,
            pageSize
        });

        const service = new ClientService({ logger: apiLogger });
        const result = await service.list(actor, searchInput);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
