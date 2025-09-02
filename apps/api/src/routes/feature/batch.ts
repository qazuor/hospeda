import { FeatureService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const featureService = new FeatureService({ logger: apiLogger });

/**
 * Request schema for batch feature loading
 */
const BatchFeatureRequestSchema = z.object({
    ids: z.array(z.string()).min(1).max(100), // Limit to 100 IDs per request
    fields: z.array(z.string()).optional() // Optional field selection
});

/**
 * Basic feature schema for API responses
 * TODO [batch-feature-schema]: Replace with proper FeatureDetailSchema when available in @repo/schemas
 */
const FeatureResponseSchema = z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    description: z.string().optional(),
    icon: z.string().optional(),
    isBuiltin: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    deletedAt: z.string().nullable().optional()
});

/**
 * Response schema for batch feature loading
 */
const BatchFeatureResponseSchema = z.array(FeatureResponseSchema.nullable());

export const featureBatchRoute = createCRUDRoute({
    method: 'post',
    path: '/features/batch',
    summary: 'Get multiple features by IDs',
    description: 'Retrieves multiple features by their IDs for entity select components',
    tags: ['Features'],
    requestBody: BatchFeatureRequestSchema,
    responseSchema: BatchFeatureResponseSchema,
    handler: async (ctx: Context, _params, body: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { ids, fields } = body as { ids: string[]; fields?: string[] };

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

        // Return just the array - createCRUDRoute will wrap it with success, data, metadata
        return features;
    },
    options: {
        skipAuth: true,
        skipValidation: false,
        cacheTTL: 300,
        customRateLimit: { requests: 50, windowMs: 60000 }
    }
});
