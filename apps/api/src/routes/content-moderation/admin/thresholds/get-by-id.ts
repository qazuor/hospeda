/**
 * Admin get moderation threshold by ID endpoint
 */
import { contentModerationThresholdSchema } from '@repo/schemas';
import { ContentModerationThresholdService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

/**
 * GET /api/v1/admin/content-moderation/thresholds/:id
 * Get moderation threshold by ID - Admin endpoint.
 */
export const adminGetThresholdByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get moderation threshold by ID (admin)',
    description: 'Retrieves a content moderation threshold by its ID',
    tags: ['Content Moderation'],
    requestParams: { id: contentModerationThresholdSchema.shape.id },
    responseSchema: contentModerationThresholdSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const thresholdService = new ContentModerationThresholdService({ logger: apiLogger });
        const actor = getActorFromContext(ctx);
        const result = await thresholdService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data ?? null;
    }
});
