import { AttractionService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const attractionService = new AttractionService({ logger: apiLogger });

/**
 * Request schema for batch attraction loading
 */
const BatchAttractionRequestSchema = z.object({
    ids: z.array(z.string()).min(1).max(100), // Limit to 100 IDs per request
    fields: z.array(z.string()).optional() // Optional field selection
});

/**
 * Basic attraction schema for API responses
 * TODO [batch-attraction-schema]: Replace with proper AttractionDetailSchema when available in @repo/schemas
 */
const AttractionResponseSchema = z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    description: z.string().optional(),
    icon: z.string().optional(),
    isBuiltin: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
    deletedAt: z.string().nullable().optional()
});

/**
 * Response schema for batch attraction loading
 */
const BatchAttractionResponseSchema = z.array(AttractionResponseSchema.nullable());

export const attractionBatchRoute = createCRUDRoute({
    method: 'post',
    path: '/attractions/batch',
    summary: 'Get multiple attractions by IDs',
    description: 'Retrieves multiple attractions by their IDs for entity select components',
    tags: ['Attractions'],
    requestBody: BatchAttractionRequestSchema,
    responseSchema: BatchAttractionResponseSchema,
    handler: async (ctx: Context, _params, body: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { ids, fields } = body as { ids: string[]; fields?: string[] };

        // Load all attractions by their IDs
        const attractions = await Promise.all(
            ids.map(async (id) => {
                const result = await attractionService.getById(actor, id);
                return result.error ? null : result.data;
            })
        );

        // Filter fields if specified
        if (fields && fields.length > 0) {
            // Always include id and name for entity selectors to work
            const requiredFields = ['id', 'name'];
            const fieldsToInclude = [...new Set([...requiredFields, ...fields])];

            return attractions.map((attraction) => {
                if (!attraction) return null;

                const filtered: Record<string, unknown> = {};
                for (const field of fieldsToInclude) {
                    if (field in attraction) {
                        filtered[field] = attraction[field as keyof typeof attraction];
                    }
                }

                return filtered;
            });
        }

        // Return just the array - createCRUDRoute will wrap it with success, data, metadata
        return attractions;
    },
    options: {
        skipAuth: true,
        skipValidation: false,
        cacheTTL: 300,
        customRateLimit: { requests: 50, windowMs: 60000 }
    }
});
