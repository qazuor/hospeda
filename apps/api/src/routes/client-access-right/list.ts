import {
    ClientAccessRightSchema,
    HttpClientAccessRightSearchSchema,
    httpToDomainClientAccessRightSearch
} from '@repo/schemas';
import { ClientAccessRightService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

export const clientAccessRightListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List client access rights',
    description: 'Returns a paginated list of client access rights with filtering options',
    tags: ['Client Access Rights'],
    requestQuery: HttpClientAccessRightSearchSchema.shape,
    responseSchema: ClientAccessRightSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query as Record<string, unknown>);

        // Convert HTTP query params to domain search input
        const searchInput = httpToDomainClientAccessRightSearch({
            ...(query as Record<string, unknown>),
            page,
            pageSize
        });

        const service = new ClientAccessRightService({ logger: apiLogger });
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
