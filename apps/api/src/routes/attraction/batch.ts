import { AttractionBatchRequestSchema, AttractionBatchResponseSchema } from '@repo/schemas';
import { AttractionService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const attractionService = new AttractionService({ logger: apiLogger });

export const attractionBatchRoute = createCRUDRoute({
    method: 'post',
    path: '/attractions/batch',
    summary: 'Get multiple attractions by IDs',
    description: 'Retrieves multiple attractions by their IDs for entity select components',
    tags: ['Attractions'],
    requestBody: AttractionBatchRequestSchema,
    responseSchema: AttractionBatchResponseSchema,
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

            return attractions.map((attraction: unknown) => {
                if (!attraction) return null;

                const filtered: Record<string, unknown> = {};
                for (const field of fieldsToInclude) {
                    if (attraction && typeof attraction === 'object' && field in attraction) {
                        filtered[field] = (attraction as Record<string, unknown>)[field];
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
