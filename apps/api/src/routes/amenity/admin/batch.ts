/**
 * Admin batch amenity endpoint
 * Retrieves multiple amenities by IDs
 */
import {
    type AmenityBatchRequest,
    AmenityBatchRequestSchema,
    AmenityBatchResponseSchema,
    PermissionEnum
} from '@repo/schemas';
import { AmenityService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const amenityService = new AmenityService({ logger: apiLogger });

/**
 * POST /api/v1/admin/amenities/batch
 * Get multiple amenities by IDs - Admin endpoint
 */
export const adminBatchAmenitiesRoute = createAdminRoute({
    method: 'post',
    path: '/batch',
    summary: 'Get multiple amenities by IDs',
    description: 'Retrieves multiple amenities by their IDs for entity select components',
    tags: ['Amenities'],
    requiredPermissions: [PermissionEnum.AMENITY_UPDATE],
    requestBody: AmenityBatchRequestSchema,
    responseSchema: AmenityBatchResponseSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
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

        return amenities;
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 50, windowMs: 60000 }
    }
});
