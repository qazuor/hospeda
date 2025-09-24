import { z } from '@hono/zod-openapi';
import { FeatureService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

export const getFeaturesForAccommodationRoute = createListRoute({
    method: 'get',
    path: '/accommodations/{accommodationId}/features',
    summary: 'Get features for an accommodation',
    description: 'Returns a list of features associated to a given accommodation',
    tags: ['Features', 'Accommodations'],
    requestParams: { accommodationId: z.string().uuid() },
    responseSchema: z.object({ id: z.string().uuid() }).partial(),
    requestQuery: {
        page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
        pageSize: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
        sortBy: z.string().optional(),
        sortOrder: z.enum(['asc', 'desc']).optional(),
        q: z.string().optional()
    },
    handler: async (ctx: Context, params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const service = new FeatureService({ logger: apiLogger });
        const q = query as {
            page?: number;
            pageSize?: number;
            sortBy?: string;
            sortOrder?: 'asc' | 'desc';
            q?: string;
        };
        const page = q.page ?? 1;
        const pageSize = q.pageSize ?? 20;

        const result = await service.getFeaturesForAccommodation(actor, {
            accommodationId: params.accommodationId as string
        });

        if (result.error) throw new Error(result.error.message);

        return {
            items: result.data.features,
            pagination: {
                page,
                pageSize,
                total: result.data.features.length,
                totalPages: 1
            }
        };
    }
});
