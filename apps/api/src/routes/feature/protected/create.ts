/**
 * Protected create feature endpoint
 * Requires authentication
 */
import {
    type FeatureCreateInput,
    FeatureCreateInputSchema,
    FeatureProtectedSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { FeatureService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const featureService = new FeatureService({ logger: apiLogger });

/**
 * POST /api/v1/protected/features
 * Create feature - Protected endpoint
 */
export const protectedCreateFeatureRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    summary: 'Create feature',
    description: 'Creates a new feature. Requires FEATURE_CREATE permission.',
    tags: ['Features'],
    requiredPermissions: [PermissionEnum.FEATURE_CREATE],
    requestBody: FeatureCreateInputSchema,
    responseSchema: FeatureProtectedSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const input = body as FeatureCreateInput;
        const result = await featureService.create(actor, input);
        if (result.error)
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        return result.data;
    }
});
