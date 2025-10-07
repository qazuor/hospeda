/**
 * Feature list endpoint - Migrated to use @repo/schemas HTTP patterns
 * Uses standardized HTTP schemas with automatic coercion and flat filter pattern
 */

import { FeatureListItemSchema, FeatureSearchHttpSchema } from '@repo/schemas';
import { FeatureService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

export const featureListRoute = createListRoute({
    method: 'get',
    path: '/features',
    summary: 'List features',
    description: 'Returns a paginated list of features using standardized HTTP schemas',
    tags: ['Features'],
    requestQuery: FeatureSearchHttpSchema.shape,
    responseSchema: FeatureListItemSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const searchParams = query as { page?: number; pageSize?: number; q?: string };
        const page = searchParams.page ?? 1;
        const pageSize = searchParams.pageSize ?? 20;

        const service = new FeatureService({ logger: apiLogger });

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
    },
    options: {
        skipAuth: true,
        cacheTTL: 120
    }
});
