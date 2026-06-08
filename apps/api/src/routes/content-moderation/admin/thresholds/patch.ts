/**
 * Admin patch moderation threshold endpoint
 */
import {
    contentModerationThresholdSchema,
    updateContentModerationThresholdSchema
} from '@repo/schemas';
import { ContentModerationThresholdService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const thresholdService = new ContentModerationThresholdService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/content-moderation/thresholds/:id
 * Patch moderation threshold - Admin endpoint.
 * Validates pending < reject per spec R8.
 */
export const adminPatchThresholdRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Patch moderation threshold (admin)',
    description: 'Partially updates a content moderation threshold. pending must be < reject.',
    tags: ['Content Moderation'],
    requestParams: { id: contentModerationThresholdSchema.shape.id },
    requestBody: updateContentModerationThresholdSchema,
    responseSchema: contentModerationThresholdSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const result = await thresholdService.update(actor, params.id as string, body);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
