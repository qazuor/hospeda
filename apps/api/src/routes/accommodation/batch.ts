import { AccommodationSchema } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Request schema for batch accommodation loading
 */
const BatchAccommodationRequestSchema = z.object({
    ids: z.array(z.string()).min(1).max(100), // Limit to 100 IDs per request
    fields: z.array(z.string()).optional() // Optional field selection
});

/**
 * Response schema for batch accommodation loading
 */
const BatchAccommodationResponseSchema = z.array(AccommodationSchema.nullable());

export const accommodationBatchRoute = createCRUDRoute({
    method: 'post',
    path: '/batch',
    summary: 'Get multiple accommodations by IDs',
    description: 'Retrieves multiple accommodations by their IDs for entity select components',
    tags: ['Accommodations'],
    requestBody: BatchAccommodationRequestSchema,
    responseSchema: BatchAccommodationResponseSchema,
    handler: async (ctx: Context, _params, body: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { ids, fields } = body as { ids: string[]; fields?: string[] };

        // Load all accommodations by their IDs
        const accommodations = await Promise.all(
            ids.map(async (id) => {
                const result = await accommodationService.getById(actor, id);
                return result.error ? null : result.data;
            })
        );

        // Filter fields if specified
        if (fields && fields.length > 0) {
            // Always include id and name for entity selectors to work
            const requiredFields = ['id', 'name'];
            const fieldsToInclude = [...new Set([...requiredFields, ...fields])];

            return accommodations.map((accommodation) => {
                if (!accommodation) return null;

                const filtered: Record<string, unknown> = {};
                for (const field of fieldsToInclude) {
                    if (field in accommodation) {
                        filtered[field] = accommodation[field as keyof typeof accommodation];
                    }
                }

                return filtered;
            });
        }

        // Return just the array - createCRUDRoute will wrap it with success, data, metadata
        return accommodations;
    },
    options: {
        skipAuth: true,
        skipValidation: false,
        cacheTTL: 300,
        customRateLimit: { requests: 50, windowMs: 60000 }
    }
});
