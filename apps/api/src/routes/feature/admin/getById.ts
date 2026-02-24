/**
 * Admin get feature by ID endpoint
 * Returns full feature information including admin fields
 */
import {
    FeatureAdminSchema,
    FeatureIdSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { FeatureService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const featureService = new FeatureService({ logger: apiLogger });

/**
 * GET /api/v1/admin/features/:id
 * Get feature by ID - Admin endpoint
 */
export const adminGetFeatureByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get feature by ID (admin)',
    description: 'Retrieves full feature information including admin fields',
    tags: ['Features'],
    requiredPermissions: [PermissionEnum.FEATURE_UPDATE],
    requestParams: {
        id: FeatureIdSchema
    },
    responseSchema: FeatureAdminSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await featureService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    },
    options: { cacheTTL: 60, customRateLimit: { requests: 100, windowMs: 60000 } }
});
