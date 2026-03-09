/**
 * Protected get user by ID endpoint
 * Allows users to view their own full profile or public info of others
 */
import { UserIdSchema, UserProtectedSchema } from '@repo/schemas';
import { ServiceError, UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const userService = new UserService({ logger: apiLogger });

/**
 * GET /api/v1/protected/users/:id
 * Get user by ID - Protected endpoint
 * Users can only view their own profile unless they have USER_READ_ALL permission
 */
export const protectedGetUserByIdRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get user by ID',
    description: 'Retrieves user information. Users can only view their own profile.',
    tags: ['Users'],
    requestParams: {
        id: UserIdSchema
    },
    responseSchema: UserProtectedSchema.nullable(),
    // Ownership is enforced by UserService._canView() which checks actor.id === entity.id
    // No ownership middleware needed here (the user entity has no 'userId' field to match on)
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
