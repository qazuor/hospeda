/**
 * Admin delete (soft) user endpoint
 * Allows admins to soft delete any user
 */
import {
    DeleteResultSchema,
    PermissionEnum,
    type ServiceErrorCode,
    UserIdSchema
} from '@repo/schemas';
import { ServiceError, UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const userService = new UserService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/users/:id
 * Soft delete user - Admin endpoint
 */
export const adminDeleteUserRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete user (admin)',
    description: 'Soft deletes a user. Admin only.',
    tags: ['Users'],
    requiredPermissions: [PermissionEnum.USER_DELETE],
    requestParams: {
        id: UserIdSchema
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const result = await userService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            deleted: result.data?.count > 0,
            id
        };
    }
});
