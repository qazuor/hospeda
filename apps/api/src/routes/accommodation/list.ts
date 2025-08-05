/**
 * Accommodation list endpoint
 * ✅ Migrated to use createListRoute (Route Factory 2.0)
 */
import { z } from '@hono/zod-openapi';
import { getActorFromContext } from '../../utils/actor';
import { createListRoute } from '../../utils/route-factory';
import { accommodationListSchema } from './schemas';

// ✅ Migrated to createListRoute with pagination support
export const accommodationListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List accommodations',
    description: 'Returns a paginated list of accommodations',
    tags: ['Accommodations'],
    requestQuery: {
        page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
        limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
        search: z.string().optional()
    },
    responseSchema: accommodationListSchema,
    handler: async (ctx, _params, _body, query) => {
        // Get actor from context (will be either authenticated user or guest)
        const _actor = getActorFromContext(ctx);

        const queryData = query as { page?: number; limit?: number; search?: string };
        const page = queryData.page || 1;
        const pageSize = queryData.limit || 10;

        // Mock accommodations data (in real implementation, this would come from a service)
        const allAccommodations = [
            { id: '1', age: 20, name: 'Ultra-man' },
            { id: '2', age: 21, name: 'Super-man' },
            { id: '3', age: 25, name: 'Iron-man' },
            { id: '4', age: 30, name: 'Spider-man' },
            { id: '5', age: 35, name: 'Bat-man' }
        ];

        // Apply search filter if provided
        const filteredAccommodations = queryData.search
            ? allAccommodations.filter((acc) =>
                  acc.name.toLowerCase().includes(queryData.search?.toLowerCase() || '')
              )
            : allAccommodations;

        // Apply pagination
        const total = filteredAccommodations.length;
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const items = filteredAccommodations.slice(startIndex, endIndex);

        return {
            items,
            pagination: {
                page,
                limit: pageSize,
                total,
                totalPages: Math.ceil(total / pageSize)
            }
        };
    },
    options: {
        cacheTTL: 60, // Cache for 1 minute
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
