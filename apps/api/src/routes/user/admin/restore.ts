/**
 * Admin restore user endpoint
 * Restores a soft-deleted user - Admin only
 */
import { PermissionEnum, UserAdminSchema, UserIdSchema } from '@repo/schemas';
import { ServiceError, UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const userService = new UserService({ logger: apiLogger });

/**
 * POST /api/v1/admin/users/:id/restore
 * Restore user - Admin endpoint
 */
export const adminRestoreUserRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore user',
    description: 'Restores a soft-deleted user. Admin only.',
    tags: ['Users'],
    requiredPermissions: [PermissionEnum.USER_RESTORE],
    requestParams: { id: UserIdSchema },
    responseSchema: UserAdminSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await userService.restore(actor, id);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    }
});
