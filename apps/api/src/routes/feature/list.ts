/**
 * Feature list endpoint - Migrated to use @repo/schemas HTTP patterns
 * Uses standardized HTTP schemas with automatic coercion and flat filter pattern
 */

import { FeatureListItemSchema, FeatureSearchHttpSchema } from '@repo/schemas';
import { FeatureService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
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
        const { page, pageSize } = extractPaginationParams(query as Record<string, unknown>);

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
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    },
    options: {
        skipAuth: true,
        cacheTTL: 120
    }
});
