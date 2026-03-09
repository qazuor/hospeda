/**
 * Admin hard delete user endpoint
 * Permanently deletes a user - Admin only
 */
import { PermissionEnum, UserIdSchema } from '@repo/schemas';
import { ServiceError, UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const userService = new UserService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/users/:id/hard
 * Hard delete user - Admin endpoint
 */
export const adminHardDeleteUserRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/hard',
    summary: 'Hard delete user',
    description: 'Permanently deletes a user by ID. Admin only.',
    tags: ['Users'],
    requiredPermissions: [PermissionEnum.USER_HARD_DELETE],
    requestParams: { id: UserIdSchema },
    responseSchema: UserIdSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await userService.hardDelete(actor, id);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return { id };
    }
});
