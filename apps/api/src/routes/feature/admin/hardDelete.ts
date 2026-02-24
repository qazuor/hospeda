/**
 * Admin hard delete feature endpoint
 * Permanently deletes a feature
 */
import { FeatureIdSchema, PermissionEnum, type ServiceErrorCode } from '@repo/schemas';
import { FeatureService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const featureService = new FeatureService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/features/:id/hard
 * Hard delete feature - Admin endpoint
 */
export const adminHardDeleteFeatureRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/hard',
    summary: 'Hard delete feature',
    description: 'Permanently deletes a feature. Requires FEATURE_DELETE permission.',
    tags: ['Features'],
    requiredPermissions: [PermissionEnum.FEATURE_DELETE],
    requestParams: {
        id: FeatureIdSchema
    },
    responseSchema: z.object({
        success: z.boolean(),
        message: z.string()
    }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await featureService.hardDelete(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            success: true,
            message: 'Feature permanently deleted'
        };
    }
});
