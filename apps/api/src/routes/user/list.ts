/**
 * User list endpoint - Migrated to use @repo/schemas HTTP patterns
 * Uses standardized HTTP schemas with automatic coercion
 */

import { UserListItemSchema, UserSearchHttpSchema } from '@repo/schemas';
import { UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

export const listUsersRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List users',
    description: 'Returns a paginated list of users using standardized HTTP schemas',
    tags: ['Users'],
    requestQuery: UserSearchHttpSchema.shape,
    responseSchema: UserListItemSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const searchParams = query as {
            page?: number;
            pageSize?: number;
            q?: string;
            email?: string;
            role?: string;
            status?: string;
            isActive?: boolean;
        };

        const page = searchParams.page ?? 1;
        const pageSize = searchParams.pageSize ?? 20;

        const service = new UserService({ logger: apiLogger });
        const result = await service.list(actor, {
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
                pageSize,
                total: result.data?.total || 0,
                totalPages: Math.ceil((result.data?.total || 0) / pageSize)
            }
        };
    },
    options: {
        skipAuth: true,
        skipValidation: true,
        cacheTTL: 60,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
