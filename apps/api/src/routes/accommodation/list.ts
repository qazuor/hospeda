/**
 * Accommodation list endpoint
 * Uses AccommodationService for real data retrieval with pagination
 */
import { z } from '@hono/zod-openapi';
import { AccommodationService } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';
import { accommodationSchema } from './schemas';

const accommodationService = new AccommodationService({ logger: apiLogger });

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
    requestQuery: {
        page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
        limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
        search: z.string().optional(),
        sortOrder: z.enum(['ASC', 'DESC']).optional()
    },
    responseSchema: accommodationSchema,
    handler: async (ctx, _params, _body, query) => {
        // Get actor from context (can be guest)
        const actor = getActorFromContext(ctx);

        const queryData = query as { page?: number; limit?: number; search?: string };
        const page = queryData.page ?? 1;
        const pageSize = queryData.limit ?? 10;

        // Call the real accommodation service
        const result = await accommodationService.list(actor, {
            page,
            pageSize
        });

        if (result.error) {
            throw new Error(result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: {
                page,
                limit: pageSize,
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
