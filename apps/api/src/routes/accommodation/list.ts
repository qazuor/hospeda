/**
 * Accommodation list endpoint
 * Uses AccommodationService for real data retrieval with pagination
 */
import { z } from '@hono/zod-openapi';
import { AccommodationListItemSchema } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

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
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        sortBy: z.string().optional(),
        sortOrder: z.enum(['asc', 'desc']).default('asc'),
        q: z.string().optional(),
        search: z.string().optional()
    },
    responseSchema: AccommodationListItemSchema,
    handler: async (ctx, _params, _body, query) => {
        // Get actor from context (can be guest)
        const actor = getActorFromContext(ctx);

        const queryData = query as {
            page?: number;
            pageSize?: number;
            search?: string;
            q?: string;
        };
        const page = queryData.page ?? 1;
        const pageSize = queryData.pageSize ?? 20;

        // Call the real accommodation service with standard list method
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
                pageSize: pageSize,
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
