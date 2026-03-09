/**
 * Admin update user endpoint
 * Allows admins to update any user
 */
import {
    PermissionEnum,
    UserAdminSchema,
    UserIdSchema,
    type UserUpdateInput,
    UserUpdateInputSchema
} from '@repo/schemas';
import { ServiceError, UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';
import { userCache } from '../../../utils/user-cache';

const userService = new UserService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/users/:id
 * Update user - Admin endpoint
 */
export const adminUpdateUserRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update user (admin)',
    description: 'Updates any user. Admin only.',
    tags: ['Users'],
    requiredPermissions: [PermissionEnum.MANAGE_USERS],
    requestParams: {
        id: UserIdSchema
    },
    requestBody: UserUpdateInputSchema,
    responseSchema: UserAdminSchema,
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
            throw new ServiceError(result.error.code, result.error.message);
        }

        // Invalidate cache for the updated user
        if (result.data?.id) {
            userCache.invalidate(result.data.id);
        }

        return result.data;
    }
});
