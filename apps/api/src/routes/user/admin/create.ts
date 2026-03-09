/**
 * Admin create user endpoint
 * Allows admins to create new users
 */
import {
    LifecycleStatusEnum,
    PermissionEnum,
    UserAdminSchema,
    type UserCreateInput,
    UserCreateInputSchema,
    VisibilityEnum
} from '@repo/schemas';
import { ServiceError, UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const userService = new UserService({ logger: apiLogger });

/**
 * POST /api/v1/admin/users
 * Create user - Admin endpoint
 */
export const adminCreateUserRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create user',
    description: 'Creates a new user. Admin only.',
    tags: ['Users'],
    requiredPermissions: [PermissionEnum.USER_CREATE],
    requestBody: UserCreateInputSchema,
    responseSchema: UserAdminSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const userData = body as UserCreateInput;
        const actor = getActorFromContext(ctx);

        const result = await userService.create(actor, {
            email: userData.email,
            emailVerified: userData.emailVerified ?? false,
            firstName: userData.firstName,
            lastName: userData.lastName,
            displayName: userData.displayName,
            role: userData.role,
            permissions: [],
            slug: userData.slug || '', // Use provided slug or let the service auto-generate
            lifecycleState: userData.lifecycleState ?? LifecycleStatusEnum.ACTIVE,
            visibility: userData.visibility ?? VisibilityEnum.PUBLIC
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
