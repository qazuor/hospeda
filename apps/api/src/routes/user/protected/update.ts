/**
 * Protected update user endpoint
 * Allows users to update their own profile
 */
import {
    PermissionEnum,
    type ServiceErrorCode,
    UserIdSchema,
    UserProtectedSchema,
    type UserUpdateInput,
    UserUpdateInputSchema
} from '@repo/schemas';
import { ServiceError, UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';
import { userCache } from '../../../utils/user-cache';

const userService = new UserService({ logger: apiLogger });

/**
 * PUT /api/v1/protected/users/:id
 * Update user - Protected endpoint
 * Users can only update their own profile
 */
export const protectedUpdateUserRoute = createProtectedRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update user',
    description: 'Updates user information. Users can only update their own profile.',
    tags: ['Users'],
    requestParams: {
        id: UserIdSchema
    },
    requestBody: UserUpdateInputSchema,
    responseSchema: UserProtectedSchema,
    ownership: {
        entityType: 'user',
        ownershipFields: ['userId'],
        bypassPermission: PermissionEnum.MANAGE_USERS
    },
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;
        const userData = body as UserUpdateInput;

        const result = await userService.update(actor, id as string, userData);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        // Invalidate cache for the updated user
        if (result.data?.id) {
            userCache.invalidate(result.data.id);
        }

        return result.data;
    }
});
