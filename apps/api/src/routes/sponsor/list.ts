import { PostSponsorSchema, PostSponsorSearchHttpSchema } from '@repo/schemas';
import { PostSponsorService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

export const sponsorListRoute = createListRoute({
    method: 'get',
    path: '/sponsors',
    summary: 'List sponsors',
    description: 'Returns a paginated list of sponsors using standardized HTTP schemas',
    tags: ['Sponsors'],
    requestQuery: PostSponsorSearchHttpSchema.shape,
    responseSchema: PostSponsorSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query as Record<string, unknown>);

        const service = new PostSponsorService({ logger: apiLogger });
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
