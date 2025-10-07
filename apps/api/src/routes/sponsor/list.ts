import { PostSponsorSchema, PostSponsorSearchHttpSchema } from '@repo/schemas';
import { PostSponsorService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
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
        const q = query as { page?: number; pageSize?: number };
        const page = q.page ?? 1;
        const pageSize = q.pageSize ?? 20;

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
            pagination: {
                page,
                pageSize,
                total: result.data?.total || 0,
                totalPages: Math.ceil((result.data?.total || 0) / pageSize)
            }
        };
    }
});
