/**
 * Admin batch feature endpoint
 * Retrieves multiple features by IDs
 */
import {
    type FeatureBatchRequest,
    FeatureBatchRequestSchema,
    FeatureBatchResponseSchema
} from '@repo/schemas';
import { FeatureService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const featureService = new FeatureService({ logger: apiLogger });

/**
 * POST /api/v1/admin/features/batch
 * Get multiple features by IDs - Admin endpoint
 */
export const adminBatchFeaturesRoute = createAdminRoute({
    method: 'post',
    path: '/batch',
    summary: 'Get multiple features by IDs',
    description: 'Retrieves multiple features by their IDs for entity select components',
    tags: ['Features'],
    requestBody: FeatureBatchRequestSchema,
    responseSchema: FeatureBatchResponseSchema,
    handler: async (ctx: Context, _params, body: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { ids, fields } = body as FeatureBatchRequest;

        // Load all features by their IDs
        const features = await Promise.all(
            ids.map(async (id) => {
                const result = await featureService.getById(actor, id);
                return result.error ? null : result.data;
            })
        );

        // Filter fields if specified
        if (fields && fields.length > 0) {
            // Always include id and name for entity selectors to work
            const requiredFields = ['id', 'name'];
            const fieldsToInclude = [...new Set([...requiredFields, ...fields])];

            return features.map((feature) => {
                if (!feature) return null;

                const filtered: Record<string, unknown> = {};
                for (const field of fieldsToInclude) {
                    if (field in feature) {
                        filtered[field] = feature[field as keyof typeof feature];
                    }
                }

                return filtered;
            });
        }

        // Return just the array - createAdminRoute will wrap it with success, data, metadata
        return features;
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 50, windowMs: 60000 }
    }
});
