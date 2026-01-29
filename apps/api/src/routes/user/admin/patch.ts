/**
 * Admin patch user endpoint
 * Allows admins to partially update any user
 */
import {
    PermissionEnum,
    type ServiceErrorCode,
    UserAdminSchema,
    UserIdSchema,
    UserPatchInputSchema
} from '@repo/schemas';
import { ServiceError, UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { transformApiInputToDomain } from '../../../utils/openapi-schema';
import { createAdminRoute } from '../../../utils/route-factory';
import { userCache } from '../../../utils/user-cache';

const userService = new UserService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/users/:id
 * Partial update user - Admin endpoint
 */
export const adminPatchUserRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update user (admin)',
    description: 'Updates specific fields of any user. Admin only.',
    tags: ['Users'],
    requiredPermissions: [PermissionEnum.MANAGE_USERS],
    requestParams: { id: UserIdSchema },
    requestBody: UserPatchInputSchema,
    responseSchema: UserAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        // Transform API input (string dates) to domain format (Date objects)
        const domainInput = transformApiInputToDomain(body);

        const result = await userService.update(actor, id, domainInput as never);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        // Invalidate cache for the updated user
        if (result.data?.authProviderUserId) {
            userCache.invalidate(result.data.authProviderUserId);
        }

        return result.data;
    },
    options: {
        customRateLimit: { requests: 20, windowMs: 60000 }
    }
});
