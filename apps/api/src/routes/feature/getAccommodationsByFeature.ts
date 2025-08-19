import { z } from '@hono/zod-openapi';
import { FeatureService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

export const getAccommodationsByFeatureRoute = createListRoute({
    method: 'get',
    path: '/features/{featureId}/accommodations',
    summary: 'Get accommodations by feature',
    description: 'Returns a list of accommodations that include a specific feature',
    tags: ['Features', 'Accommodations'],
    requestParams: { featureId: z.string().uuid() },
    responseSchema: z.object({ id: z.string().uuid() }).partial(),
    requestQuery: {
        page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
        limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional()
    },
    handler: async (ctx: Context, params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const service = new FeatureService({ logger: apiLogger });
        const result = await service.getAccommodationsByFeature(actor, {
            featureId: params.featureId as string
        });
        if (result.error) throw new Error(result.error.message);
        const q = query as { page?: number; limit?: number };
        const page = q.page ?? 1;
        const pageSize = q.limit ?? 10;
        return {
            items: result.data.accommodations,
            pagination: {
                page,
                limit: pageSize,
                total: result.data.accommodations.length,
                totalPages: 1
            }
        };
    }
});
