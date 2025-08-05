/**
 * Example endpoint showing how to use ResponseFactory.createListResponses
 * This demonstrates how to handle paginated responses with proper typing
 */

import { z } from '@hono/zod-openapi';
import { UserService } from '@repo/service-core';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';
import { UserSchema } from './schemas';

const userService = new UserService({ logger: apiLogger });

/**
 * Example: List users endpoint using ResponseFactory.createListResponses
 * This demonstrates how to handle paginated responses with proper typing
 */
export const listUsersRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List users',
    description: 'Returns a paginated list of users',
    tags: ['Users'],
    requestQuery: {
        page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
        limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
        search: z.string().optional()
    },
    responseSchema: UserSchema,
    handler: async (ctx, _params, _body, query) => {
        const queryData = query as { page?: number; limit?: number; search?: string };

        // Get actor from context (assuming it's set by auth middleware)
        const actor = ctx.get('actor');

        // Call the real user service
        const result = await userService.list(actor, {
            page: queryData.page || 1,
            pageSize: queryData.limit || 10
        });

        if (result.error) {
            throw new Error(result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: {
                page: queryData.page || 1,
                limit: queryData.limit || 10,
                total: result.data?.total || 0,
                totalPages: Math.ceil((result.data?.total || 0) / (queryData.limit || 10))
            }
        };
    }
});
