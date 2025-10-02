import { z } from '@hono/zod-openapi';
import { type HttpFeatureSearch, HttpFeatureSearchSchema } from '@repo/schemas';
import { FeatureService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

export const searchFeaturesRoute = createListRoute({
    method: 'get',
    path: '/features/search',
    summary: 'Search features with advanced filtering',
    description: 'Search and filter features by name, category, availability, and other criteria',
    tags: ['Features'],
    requestQuery: HttpFeatureSearchSchema.shape, // ✅ Using @repo/schemas
    responseSchema: z.object({ id: z.string().uuid() }).partial(),
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const searchParams = query as HttpFeatureSearch;
        const page = searchParams.page ?? 1;
        const pageSize = searchParams.pageSize ?? 20;

        const service = new FeatureService({ logger: apiLogger });
        const result = await service.search(actor, searchParams);

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
