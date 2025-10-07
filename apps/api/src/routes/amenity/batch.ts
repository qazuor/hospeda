import {
    type AmenityBatchRequest,
    AmenityBatchRequestSchema,
    AmenityBatchResponseSchema
} from '@repo/schemas';
import { AmenityService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const amenityService = new AmenityService({ logger: apiLogger });

export const amenityBatchRoute = createCRUDRoute({
    method: 'post',
    path: '/amenities/batch',
    summary: 'Get multiple amenities by IDs',
    description: 'Retrieves multiple amenities by their IDs for entity select components',
    tags: ['Amenities'],
    requestBody: AmenityBatchRequestSchema,
    responseSchema: AmenityBatchResponseSchema,
    handler: async (ctx: Context, _params, body: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { ids, fields } = body as AmenityBatchRequest;

        // Load all amenities by their IDs
        const amenities = await Promise.all(
            ids.map(async (id) => {
                const result = await amenityService.getById(actor, id);
                return result.error ? null : result.data;
            })
        );

        // Filter fields if specified
        if (fields && fields.length > 0) {
            // Always include id and name for entity selectors to work
            const requiredFields = ['id', 'name'];
            const fieldsToInclude = [...new Set([...requiredFields, ...fields])];

            return amenities.map((amenity) => {
                if (!amenity) return null;

                const filtered: Record<string, unknown> = {};
                for (const field of fieldsToInclude) {
                    if (field in amenity) {
                        filtered[field] = amenity[field as keyof typeof amenity];
                    }
                }

                return filtered;
            });
        }

        // Return just the array - createCRUDRoute will wrap it with success, data, metadata
        return amenities;
    },
    options: {
        skipAuth: true,
        skipValidation: false,
        cacheTTL: 300,
        customRateLimit: { requests: 50, windowMs: 60000 }
    }
});
