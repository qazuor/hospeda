/**
 * Admin get user by ID endpoint
 * Returns full user information including admin fields
 */
import { PermissionEnum, UserAdminSchema, UserIdSchema } from '@repo/schemas';
import { ServiceError, UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const userService = new UserService({ logger: apiLogger });

/**
 * GET /api/v1/admin/users/:id
 * Get user by ID - Admin endpoint
 */
export const adminGetUserByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get user by ID (admin)',
    description: 'Retrieves full user information including admin fields',
    tags: ['Users'],
    requiredPermissions: [PermissionEnum.USER_READ_ALL],
    requestParams: {
        id: UserIdSchema
    },
    responseSchema: UserAdminSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await userService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
