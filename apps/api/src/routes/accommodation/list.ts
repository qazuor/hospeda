import { AccommodationListItemSchema, AccommodationSearchSchema } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
/**
 * Accommodation list endpoint
 * Uses AccommodationService for real data retrieval with pagination
 */
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * HTTP-compatible version of AccommodationSearchSchema with z.coerce for query string parameters
 */
const AccommodationSearchHttpSchema = AccommodationSearchSchema.extend({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    // Handle other numeric fields that need coercion
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce.number().positive().optional(),
    minGuests: z.coerce.number().int().min(1).optional(),
    maxGuests: z.coerce.number().int().min(1).optional(),
    minBedrooms: z.coerce.number().int().min(0).optional(),
    maxBedrooms: z.coerce.number().int().min(0).optional(),
    minBathrooms: z.coerce.number().int().min(0).optional(),
    maxBathrooms: z.coerce.number().int().min(0).optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    maxRating: z.coerce.number().min(0).max(5).optional(),
    isFeatured: z.coerce.boolean().optional(),
    isAvailable: z.coerce.boolean().optional()
});

/**
 * List accommodations endpoint with pagination
 * Public endpoint that doesn't require authentication
 */
export const accommodationListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List accommodations',
    description: 'Returns a paginated list of accommodations using the AccommodationService',
    tags: ['Accommodations'],
    requestQuery: AccommodationSearchHttpSchema.shape,
    responseSchema: AccommodationListItemSchema,
    handler: async (ctx, _params, _body, query) => {
        // Get actor from context (can be guest)
        const actor = getActorFromContext(ctx);

        // Ensure query is defined and has defaults
        const queryParams = query || {};
        const page = Number(queryParams.page) || 1;
        const pageSize = Number(queryParams.pageSize) || 20;

        // Call the real accommodation service with the full query params
        const result = await accommodationService.list(actor, queryParams);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: {
                page,
                pageSize,
                total: result.data?.total || 0,
                totalPages: Math.ceil((result.data?.total || 0) / pageSize)
            }
        };
    },
    options: {
        skipAuth: true, // Public endpoint
        skipValidation: true, // Skip header validation for public endpoint
        cacheTTL: 60, // Cache for 1 minute
        customRateLimit: { requests: 200, windowMs: 60000 } // 200 requests per minute
    }
});
