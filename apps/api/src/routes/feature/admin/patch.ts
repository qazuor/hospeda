/**
 * Admin patch feature endpoint
 * Allows admins to partially update any feature
 */
import {
    FeatureAdminSchema,
    FeatureIdSchema,
    FeaturePatchInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { FeatureService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { transformApiInputToDomain } from '../../../utils/openapi-schema';
import { createAdminRoute } from '../../../utils/route-factory';

const featureService = new FeatureService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/features/:id
 * Partial update feature - Admin endpoint
 */
export const adminPatchFeatureRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update feature (admin)',
    description: 'Updates specific fields of any feature. Admin only.',
    tags: ['Features'],
    requiredPermissions: [PermissionEnum.FEATURE_UPDATE],
    requestParams: {
        id: FeatureIdSchema
    },
    requestBody: FeaturePatchInputSchema,
    responseSchema: FeatureAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const domainInput = transformApiInputToDomain(body);

        const result = await featureService.update(actor, id, domainInput as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: { customRateLimit: { requests: 20, windowMs: 60000 } }
});
