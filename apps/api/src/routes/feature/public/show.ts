/**
 * Public get feature by ID endpoint
 * Returns a single feature by its ID
 */
import { FeatureIdSchema, FeaturePublicSchema, type ServiceErrorCode } from '@repo/schemas';
import { FeatureService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const featureService = new FeatureService({ logger: apiLogger });

/**
 * GET /api/v1/public/features/:id
 * Get feature by ID - Public endpoint
 */
export const publicGetFeatureByIdRoute = createPublicRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get feature by ID',
    description: 'Retrieves a feature by its ID',
    tags: ['Features'],
    requestParams: {
        id: FeatureIdSchema
    },
    responseSchema: FeaturePublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await featureService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
